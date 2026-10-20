# 막과 막 사이

두 대본의 내용을 빠르게 이해하고, 읽던 맥락을 이어가는 개인 대본 독서실입니다.

- 《시동라사》 16장면, 《템프 파일》 6장면
- 명확하게 분리된 요약 / 원문 탭
- 읽음 체크박스와 이전·다음 장면 이동을 별도 조작, 요약·원문 진도 독립 저장
- 이전 장까지의 맥락, 등장인물 기본 관계, 장면 메모와 작품 전체 기억 메모
- 모드별 읽던 문단·스크롤 위치 복원, 문단 책갈피
- 글자 크기 12~32px(신규 기본18px), 기존 사용자 설정 보존, 종이·밤 테마
- 인물별 은은한 이름 색상: 본명·짧은 이름·원문 표기 변형에 같은 색상, 보기 설정에서 끄기 가능
- 브라우저 자동 저장, 진도 JSON 내보내기·불러오기
- 폰에서는 한 줄 상단 도구, 보기 설정 창, 하단 장면 이동·진도 표시, 화면 가장자리 안전 여백 제공
- 흰 배경·단색 버튼·간결한 목록과 탭을 사용하는 본문 중심 디자인
- 이전 내용·등장인물, 본문, 읽음 표시, 내 메모를 구분한 영역

## 저장소와 배포

- GitHub: https://github.com/JonathanBlackDoctor/script-reading-room (공개)
- 읽기 페이지: https://jonathanblackdoctor.github.io/script-reading-room/ (로그인 없이 접속)
- 사용자 선택에 따라 GitHub Pages로 이전했습니다. 현재 계정 요금제의 Pages 제약으로 저장소도 공개했습니다. `main`은 전체 소스, `gh-pages`는 `dist/`의 정적 배포본입니다. `.nojekyll`로 Jekyll 변환을 생략합니다.
- 이전 Sites 주소는 기존 진도 백업용으로 유지합니다: https://script-reading-room-20261019-b7k2.alpaomegastartend.chatgpt.site (기존 ChatGPT 계정 로그인). 이전 페이지에서 ‘진도 백업’ 후 새 페이지에서 ‘백업 불러오기’를 사용하세요. 폰에서는 목차 안에 있습니다.
- 다음 배포: 검증한 소스를 커밋한 뒤 `git push origin HEAD:main`, `git subtree split --prefix dist`가 출력한 SHA를 `git push origin <SHA>:gh-pages`로 올립니다. Pages의 배포 성공을 확인합니다. 원격 `sites`는 이전 소스 미러이며 새 배포에 사용하지 않습니다.

## 실행

`dist/index.html`을 로컬에서 열거나, `dist/`를 정적 HTTP 서버로 제공하면 됩니다. 진도 저장은 브라우저와 사이트 주소별로 분리됩니다. 다른 기기로 옮기려면 진도 백업을 사용하세요. 서버 동기화 기능은 없습니다.

외부 폰트·분석기·CDN·런타임 라이브러리 의존성이 없습니다. 원문과 요약은 모두 `dist/data.js`에 포함됩니다. 현재 배포본과 저장소는 공개 상태입니다.

## 파일

- `dist/index.html`, `styles.css`, `app.js`: 화면과 읽기 동작
- `dist/mobile.css`: 폰 본문·상단·하단·설정 창 레이아웃
- `dist/simple.css`: 단색·장식 최소화 디자인, 서재 목록·읽기 화면·밤 테마
- `dist/state.js`: 상태 검증·정규화·진도 계산
- `dist/data.js`: 두 대본의 원문과 장면별 해설
- `editorial.json`: 장면 제목·요약·이전 맥락·읽기 질문
- `build_data.py`: 상위 작업 폴더의 추출문에서 데이터 생성, 전체 문단 보존 검증
- `test-state.cjs`: 진도·백업·원문 버전 일치 검증
- `test-ui.cjs`, `test-mobile.cjs`: Chrome 기능 회귀·폰 터치 환경 및 큰 글자·가로 화면 검증
- `test-characters.cjs`: 인물 색상 일관성·원문 텍스트 보존·옵션 저장·구버전 백업 호환·밤 테마·좁은 화면 검증
- `.openai/hosting.json`: 이전 비공개 Sites 배포 설정 (현재 GitHub Pages 배포에는 사용하지 않음)
- `.openai/github.json`: 사용자 GitHub 저장소와 배포 주소

## 콘텐츠 원칙

사용자가 제공한 HWP 본문을 보존하고, 요약·해석은 원문과 분리했습니다. 장면 제목은 읽기 편의를 위해 붙였습니다. 작품 속 의료·수사 설명은 인물의 말과 극의 설정이며 사실 검증된 안내로 취급하지 않습니다. 원문의 오탈자와 연도 서술 차이는 임의로 고치지 않았습니다. 결말의 모호한 지점은 확정하지 않았습니다.

진도 저장 키는 두 원문의 내용 해시를 포함합니다. 원문 버전이 달라지면 기존 진도를 자동으로 읽음 인증하지 않습니다. 백업 불러오기는 원문 해시를 확인하고, 현재 상태를 브라우저의 `:before-import` 보관 키에 남긴 뒤 적용합니다.

## 검증

```sh
python build_data.py
node --check dist/app.js
node --test test-state.cjs
```
