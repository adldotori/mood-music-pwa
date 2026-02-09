# 무드뮤직 (Mood Music) 🎵

감정에 따른 맞춤 음악 추천 PWA (Progressive Web App)

## 🎯 개념

사용자가 현재 기분을 설명하면 AI가 그에 맞는 음악을 추천하고, YouTube를 통해 연속 재생하는 모바일 중심의 음악 앱입니다.

## ✨ 주요 기능

- **감정 기반 음악 추천**: OpenAI를 이용한 맞춤형 음악 추천
- **빠른 감정 선택**: 12가지 사전 정의된 감정 카테고리
- **사용자 정의 감정**: 자유로운 텍스트 입력으로 세밀한 감정 표현
- **YouTube 연속 재생**: 끊김 없는 음악 스트리밍
- **최근 감정 기록**: localStorage를 통한 이용 기록 저장
- **PWA 지원**: 아이폰 홈 화면 추가 가능
- **반응형 디자인**: 모바일 우선 설계 (375px-430px 최적화)

## 🛠️ 기술 스택

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **PWA**: next-pwa
- **Music Source**: YouTube (youtube-sr 패키지)
- **AI**: OpenAI GPT-3.5-turbo
- **Font**: Noto Sans KR (한글 지원)

## 📱 페이지 구조

### 홈페이지 (`/`)
- 최근 사용한 감정 표시
- 12가지 빠른 감정 선택 그리드
- 사용자 정의 감정 입력 필드

### 플레이어 페이지 (`/play?mood=...`)
- YouTube 플레이어 내장
- 재생목록/큐 표시
- 재생 컨트롤 (이전/재생/일시정지/다음)
- "더 추가하기" 기능

## 🚀 설치 및 실행

### 1. 저장소 클론
```bash
git clone https://github.com/yourusername/mood-music.git
cd mood-music
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 환경 변수 설정
```bash
cp .env.example .env.local
```

`.env.local` 파일에 OpenAI API 키를 설정하세요:
```
OPENAI_API_KEY=your_openai_api_key_here
```

### 4. 개발 서버 실행
```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000)에서 앱을 확인할 수 있습니다.

## 📦 빌드 및 배포

### 로컬 빌드
```bash
npm run build
npm start
```

### Vercel 배포
1. [Vercel](https://vercel.com)에 계정 생성
2. GitHub 저장소 연결
3. 환경 변수 `OPENAI_API_KEY` 설정
4. 자동 배포 완료

## 🎨 디자인 특징

- **다크 테마**: 기본 검은 배경
- **보라색 그라데이션**: 주요 액센트 컬러
- **글래스모피즘**: 반투명 유리 효과
- **부드러운 애니메이션**: 호버 및 터치 반응
- **한국어 UI**: 완전한 한글 인터페이스

## 📱 PWA 기능

- 오프라인 지원 (캐시된 페이지)
- 아이폰 홈 화면 추가 가능
- 앱과 같은 사용자 경험
- 빠른 로딩 (Service Worker)

## 🎵 음악 추천 시스템

### OpenAI 프롬프트
- 감정에 맞는 다양한 장르의 곡 추천
- 국내외 인기곡 혼합
- YouTube에서 찾기 쉬운 곡들로 구성

### YouTube 검색
- `youtube-sr` 패키지 사용 (API 키 불필요)
- 자동 비디오 ID 추출
- 썸네일 및 메타데이터 수집

## 🔧 API 엔드포인트

### `POST /api/recommend`
감정 기반 음악 추천
```json
{
  "mood": "잔잔한",
  "count": 10,
  "exclude": ["이미 추천된 곡들"]
}
```

### `POST /api/search`
YouTube 검색
```json
{
  "query": "아티스트명 곡명"
}
```

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 🙏 감사의 말

- [Next.js](https://nextjs.org/) - React 프레임워크
- [OpenAI](https://openai.com/) - AI 음악 추천
- [YouTube](https://youtube.com/) - 음악 스트리밍
- [Tailwind CSS](https://tailwindcss.com/) - 스타일링
- [Vercel](https://vercel.com/) - 배포 플랫폼
