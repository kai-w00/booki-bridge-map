let map;
let stations = [];
let filteredStations = [];
let markers = new Map();
let markerLayer;
let routeLayer;
let routeLine = null;
let routeMode = false;
let routeStations = [];

const riverColors = {
  "한강": "#2563eb",
  "금강": "#111827",
  "영산강": "#dc2626",
  "낙동강": "#16a34a",
  "기타": "#64748b"
};

const state = {
  search: "",
  rivers: new Set(),
  groups: new Set()
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  initMap();

  const res = await fetch("./data/stations.json");
  stations = await res.json();

  stations = stations.map((s, i) => ({
    ...s,
    uid: s.id ?? i + 1
  }));

  initFilters();
  bindEvents();
  applyFilters();

  document.getElementById("totalCount").textContent = stations.length;
}

function initMap() {
  map = L.map("map", {
    zoomControl: true,
    preferCanvas: true
  }).setView([36.4, 127.8], 7);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
  }).addTo(map);

  markerLayer = L.layerGroup().addTo(map);
  routeLayer = L.layerGroup().addTo(map);
}

function getFields(station) {
  return station.fields || station.raw || station.details || {};
}

function initFilters() {
  const rivers = [...new Set(stations.map(s => s.river || "기타"))].sort();
  const groups = [...new Set(stations.map(s => s.group || "미분류"))].sort();

  state.rivers = new Set(rivers);
  state.groups = new Set(groups);

  const riverBox = document.getElementById("riverFilters");
  riverBox.innerHTML = "";

  rivers.forEach(river => {
    const chip = document.createElement("button");
    chip.className = "filter-chip active";
    chip.textContent = `${river} ${stations.filter(s => (s.river || "기타") === river).length}`;

    chip.onclick = () => {
      toggleSet(state.rivers, river);
      chip.classList.toggle("active", state.rivers.has(river));
      applyFilters();
    };

    riverBox.appendChild(chip);
  });

  const groupBox = document.getElementById("groupFilters");
  groupBox.innerHTML = "";

  groups.forEach(group => {
    const chip = document.createElement("button");
    chip.className = "filter-chip active";
    chip.textContent = group;

    chip.onclick = () => {
      toggleSet(state.groups, group);
      chip.classList.toggle("active", state.groups.has(group));
      applyFilters();
    };

    groupBox.appendChild(chip);
  });

  document.getElementById("groupCount").textContent = `${groups.length}개`;
}

function bindEvents() {
  document.getElementById("searchInput").oninput = e => {
    state.search = e.target.value.trim().toLowerCase();
    applyFilters();
  };

  document.getElementById("resetFilterBtn").onclick = () => {
    state.search = "";
    document.getElementById("searchInput").value = "";

    state.rivers = new Set([...new Set(stations.map(s => s.river || "기타"))]);
    state.groups = new Set([...new Set(stations.map(s => s.group || "미분류"))]);

    document.querySelectorAll(".filter-chip").forEach(e => {
      e.classList.add("active");
    });

    applyFilters();
  };

  document.getElementById("fitBtn").onclick = fitVisibleMarkers;

  document.getElementById("closeDetailBtn").onclick = () => {
    document.getElementById("detailPanel").classList.add("hidden");
  };

  document.getElementById("routeModeBtn").onclick = () => {
    routeMode = !routeMode;

    document.getElementById("routeModeBtn").textContent =
      routeMode ? "루트 설정 중" : "점검 루트 설정";

    document.getElementById("routePanel").classList.toggle(
      "hidden",
      !routeMode && routeStations.length === 0
    );
  };

  document.getElementById("clearRouteBtn").onclick = clearRoute;
  document.getElementById("downloadRouteBtn").onclick = downloadRoute;
}

function toggleSet(set, value) {
  if (set.has(value)) {
    set.delete(value);
  } else {
    set.add(value);
  }
}

function applyFilters() {
  filteredStations = stations.filter(station => {
    const river = station.river || "기타";
    const group = station.group || "미분류";
    const fields = getFields(station);

    if (!state.rivers.has(river)) return false;
    if (!state.groups.has(group)) return false;

    if (!state.search) return true;

    const haystack = [
      station.name,
      station.river,
      station.group,
      station.lat,
      station.lng,
      ...Object.keys(fields),
      ...Object.values(fields)
    ].join(" ").toLowerCase();

    return haystack.includes(state.search);
  });

  renderMarkers();
  renderStationList();

  document.getElementById("visibleCount").textContent = filteredStations.length;

  document.getElementById("currentTitle").textContent =
    state.search ? `"${state.search}" 검색 결과` : "전체 관측소";

  document.getElementById("currentSubtitle").textContent =
    `${filteredStations.length}개 관측소 표시 중`;

  if (filteredStations.length) {
    fitVisibleMarkers();
  }
}

function renderMarkers() {
  markerLayer.clearLayers();
  markers.clear();

  filteredStations.forEach(station => {
    const marker = L.circleMarker([station.lat, station.lng], {
      radius: 8,
      color: "#ffffff",
      weight: 2,
      fillColor: riverColors[station.river] || riverColors["기타"],
      fillOpacity: 0.92
    });

    marker.bindPopup(makePopupHtml(station));

    marker.on("click", () => {
      if (routeMode) {
        addToRoute(station);
      } else {
        showDetail(station);
      }
    });

    marker.addTo(markerLayer);
    markers.set(station.uid, marker);
  });
}

function renderStationList() {
  const list = document.getElementById("stationList");
  list.innerHTML = "";

  if (!filteredStations.length) {
    list.innerHTML =
      '<div class="station-item"><div class="station-address">검색 결과가 없습니다.</div></div>';
    return;
  }

  filteredStations.forEach(station => {
    const item = document.createElement("div");
    item.className = "station-item";

    const address =
      getField(station, ["주소", "찾아가는곳", "찾아가는 곳", "주소 (찾아가는 곳)"]) ||
      "주소 정보 없음";

    item.innerHTML = `
      <div class="station-name">
        <span>${escapeHtml(station.name)}</span>
        <span class="river-badge">${escapeHtml(station.river || "기타")}</span>
      </div>
      <div class="station-address">${escapeHtml(address)}</div>
    `;

    item.onclick = () => {
      const marker = markers.get(station.uid);
      map.setView([station.lat, station.lng], 16);

      if (marker) {
        marker.openPopup();
      }

      showDetail(station);
    };

    list.appendChild(item);
  });
}

function makePopupHtml(station) {
  const address =
    getField(station, ["주소", "찾아가는곳", "찾아가는 곳", "주소 (찾아가는 곳)"]) || "";

  return `
    <h3 class="popup-title">${escapeHtml(station.name)}</h3>
    <div class="popup-meta">${escapeHtml(station.river || "")} · ${escapeHtml(station.group || "")}</div>
    <div class="popup-meta">${escapeHtml(address)}</div>
    <button class="popup-btn" onclick="window.__showStationDetail(${station.uid})">상세정보 보기</button>
  `;
}

window.__showStationDetail = uid => {
  const station = stations.find(x => x.uid === uid);
  if (station) {
    showDetail(station);
  }
};

function showDetail(station) {
  const panel = document.getElementById("detailPanel");
  const content = document.getElementById("detailContent");
  const fields = getFields(station);

  const rows = Object.entries(fields)
    .map(([key, value]) => {
      return `
        <tr>
          <th>${escapeHtml(key)}</th>
          <td>${escapeHtml(value || "")}</td>
        </tr>
      `;
    })
    .join("");

  content.innerHTML = `
    <h3 class="detail-title">${escapeHtml(station.name)}</h3>
    <p class="detail-subtitle">
      ${escapeHtml(station.river || "")} · ${escapeHtml(station.group || "")}<br>
      좌표: ${station.lat}, ${station.lng}
    </p>
    <table class="detail-table">
      <tbody>
        ${rows || "<tr><td>상세정보 없음</td></tr>"}
      </tbody>
    </table>
  `;

  panel.classList.remove("hidden");
}

function fitVisibleMarkers() {
  if (!filteredStations.length) return;

  const bounds = L.latLngBounds(
    filteredStations.map(station => [station.lat, station.lng])
  );

  map.fitBounds(bounds, {
    padding: [70, 70],
    maxZoom: 13
  });
}

function addToRoute(station) {
  if (routeStations.some(x => x.uid === station.uid)) return;

  routeStations.push(station);
  renderRoute();
}

function renderRoute() {
  routeLayer.clearLayers();

  if (routeLine) {
    map.removeLayer(routeLine);
    routeLine = null;
  }

  document.getElementById("routePanel").classList.remove("hidden");

  const list = document.getElementById("routeList");
  list.classList.remove("empty");

  if (!routeStations.length) {
    list.classList.add("empty");
    list.innerHTML = "아직 선택된 관측소가 없습니다.";
    return;
  }

  list.innerHTML = "";

  routeStations.forEach((station, index) => {
    const address =
      getField(station, ["주소", "찾아가는곳", "찾아가는 곳", "주소 (찾아가는 곳)"]) || "";

    const icon = L.divIcon({
      className: "",
      html: `<div class="route-marker">${index + 1}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    L.marker([station.lat, station.lng], { icon })
      .bindPopup(`${index + 1}. ${escapeHtml(station.name)}`)
      .addTo(routeLayer);

    const item = document.createElement("div");
    item.className = "route-item";
    item.innerHTML = `
      <div class="route-name">
        <span class="route-order">${index + 1}</span>
        ${escapeHtml(station.name)}
      </div>
      <div class="route-address">${escapeHtml(address)}</div>
    `;

    list.appendChild(item);
  });

  if (routeStations.length >= 2) {
    routeLine = L.polyline(
      routeStations.map(station => [station.lat, station.lng]),
      {
        color: "#38bdf8",
        weight: 4,
        opacity: 0.88,
        dashArray: "8, 8"
      }
    ).addTo(map);
  }
}

function clearRoute() {
  routeStations = [];
  routeLayer.clearLayers();

  if (routeLine) {
    map.removeLayer(routeLine);
    routeLine = null;
  }

  renderRoute();
  document.getElementById("routePanel").classList.add("hidden");
}

function downloadRoute() {
  const route = {
    route_name: "점검루트",
    created_at: new Date().toISOString(),
    stations: routeStations.map((station, index) => ({
      order: index + 1,
      id: station.id,
      name: station.name,
      river: station.river,
      group: station.group,
      lat: station.lat,
      lng: station.lng,
      address:
        getField(station, ["주소", "찾아가는곳", "찾아가는 곳", "주소 (찾아가는 곳)"]) || "",
      fields: getFields(station)
    }))
  };

  const blob = new Blob([JSON.stringify(route, null, 2)], {
    type: "application/json;charset=utf-8"
  });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `booki_route_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();

  URL.revokeObjectURL(a.href);
}

function getField(station, keys) {
  const fields = getFields(station);

  for (const key of keys) {
    if (fields[key]) {
      return fields[key];
    }
  }

  const provincePattern =
    /(서울|경기|강원|충북|충남|경북|경남|전북|전남|대구|부산|광주|대전|울산|세종|제주|인천)/;

  for (const [key, value] of Object.entries(fields)) {
    if (provincePattern.test(String(value)) && key !== "이름") {
      return value;
    }
  }

  return "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
