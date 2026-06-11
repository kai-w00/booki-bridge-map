# Booki Bridge CCTV Map

4대강 교량 CCTV 관측소 정보를 지도에 표시하는 GitHub Pages용 정적 웹페이지입니다.

## 기능

- `data/stations.json` 기반 관측소 마커 표시
- 한강 / 금강 / 영산강 / 낙동강 필터
- 레이어/그룹 필터
- 교량명, 주소, IP, 회선번호 검색
- 마커 클릭 시 상세정보 표시
- 점검 루트 설정
- 루트 JSON 다운로드

## 로컬 실행

```bash
python -m http.server 8000
```

브라우저에서 `http://localhost:8000` 접속.

## GitHub Pages 배포

1. GitHub에 새 저장소 생성
2. 이 프로젝트 파일 업로드
3. Settings → Pages
4. Branch: `main`, Folder: `/root`

## 주의

`stations.json`에는 내부 IP, 계정, 비밀번호, 회선번호가 포함될 수 있습니다. 공개 저장소에 올리면 안 됩니다.
