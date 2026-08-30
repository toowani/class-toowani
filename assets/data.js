/* class.toowani.com — 학기 · 과목 데이터
 * 여기만 고치면 사이트 전체가 바뀝니다. (JS 객체, 주석 참고)
 * day: 1=월 2=화 3=수 4=목 5=금
 */

window.SEMESTERS = [
  { id: "1-1", label: "1학년 1학기", state: "past" },
  { id: "1-2", label: "1학년 2학기", state: "past" },
  { id: "2-1", label: "2학년 1학기", state: "past" },
  { id: "2-summer", label: "2학년 여름 계절학기", state: "past", season: true },
  { id: "2-2", label: "2학년 2학기", state: "past" },
  { id: "3-1", label: "3학년 1학기", state: "past" },
  { id: "3-summer", label: "3학년 여름 계절학기", state: "past", season: true },
  { id: "3-2", label: "3학년 2학기", state: "current" }
];

/* ── 3학년 2학기 (2026 가을) ───────────────────────────── */
window.SEM_3_2 = {
  id: "3-2",
  label: "3학년 2학기",
  term: "2026 가을",
  startMonday: "2026-08-31",   // 1주차 월요일 = 개강일
  weeks: 16,
  courses: [
    {
      id: "info-theory",
      name: "정보이론",
      en: "Information Theory",
      code: "EC4310-01",
      prof: "이흥노",
      credits: "3/0/3",
      color: "#9EB7E8",
      sttLang: "ko-KR",
      book: "Cover & Thomas, Elements of Information Theory (Wiley, 2006)",
      grading: [
        ["중간", 30], ["기말", 30], ["출석", 20], ["과제", 20]
      ],
      meetings: [
        { day: 1, start: "09:00", end: "10:30", room: "지스트대학 C동 110" },
        { day: 3, start: "09:00", end: "10:30", room: "지스트대학 C동 110" }
      ],
      keywords: ["entropy", "mutual information", "AEP", "Markov", "compression", "channel capacity", "differential entropy", "Gaussian", "blockchain", "cryptography", "엔트로피", "상호정보량", "채널용량"],
      weekTopics: [
        "Introduction to Information Theory, Entropy",
        "Entropy, Relative Entropy and Mutual Information",
        "Entropy, Relative Entropy and Mutual Information",
        "Asymptotic Equipartition Property",
        "AEP / Entropy Rates of a Stochastic Process",
        "Entropy rates of Markov Chain",
        "Data compression",
        "Data compression",
        "Channel capacity theorems / forward",
        "Channel capacity theorems / reverse",
        "Differential entropy",
        "Gaussian channel capacity",
        "Gaussian channel capacity",
        "Blockchain, Hash Puzzles",
        "Cryptography",
        "Summary"
      ],
      weekMarks: { 7: "Midterm 1", 12: "Midterm 2" }
    },
    {
      id: "comp-arch",
      name: "컴퓨터 구조",
      en: "Computer Architecture",
      code: "EC2204-01",
      prof: "Brian J. d'Auriol (브라이언 도리얼)",
      credits: "3/0/3",
      color: "#F0AFB6",
      sttLang: "en-US",
      book: "Patterson & Hennessy, Computer Organization and Design, 5th Ed.",
      grading: [
        ["시험", 62], ["과제", 32], ["워크시트", 2], ["출석", 4]
      ],
      note: "상대평가 지침(2026 EECS 학부교육위) 관련 안내 있음 — 절대평가 후 필요 시 선형 스케일링.",
      meetings: [
        { day: 1, start: "10:30", end: "12:00", room: "지스트대학 A동 227" },
        { day: 3, start: "10:30", end: "12:00", room: "지스트대학 A동 227" }
      ],
      keywords: ["MIPS", "pipeline", "hazard", "forwarding", "cache", "virtual memory", "ISA", "micro-programming", "single cycle", "multi cycle", "floating point", "DMA"],
      weekTopics: [
        "Computer Abstraction, review of EC2203",
        "Computer Technologies, n-bit multiplication (data & control paths)",
        "Floating point addition algorithm (2-state controller)",
        "Instruction Set Design (MIPS), single cycle architecture",
        "Instruction Set Design (MIPS), multi cycle architecture",
        "Micro-programming",
        "Midterm exam",
        "MIPS pipeline architecture",
        "Data and control dependency analysis, hazards",
        "MIPS pipeline hazard detection and forwarding circuits",
        "Optional architecture: transputer (stack vs register file, ISA 비교)",
        "Optional architecture: Mano (memory-register vs load-store 등)",
        "TMS320C40, parallelism, multiple bus, DMA, network interface",
        "Cache memory",
        "Virtual memory",
        "Final Exam"
      ],
      weekMarks: { 7: "중간고사", 16: "기말고사" }
    },
    {
      id: "ai-video",
      name: "AI 영상스튜디오",
      en: "AI Video Studio",
      code: "CT4202-01",
      prof: "송은성",
      credits: "3/0/3",
      color: "#E7BFB6",
      sttLang: "ko-KR",
      book: "The Filmmaker's Handbook (Ascher & Pincus) / In the Blink of an Eye (Murch)",
      grading: [
        ["기말", 50], ["중간", 20], ["출석", 15], ["과제", 15]
      ],
      meetings: [
        { day: 2, start: "09:00", end: "10:30", room: "다산빌딩(학제융합연구동) 615" },
        { day: 4, start: "09:00", end: "10:30", room: "다산빌딩(학제융합연구동) 615" }
      ],
      keywords: ["프롬프트", "generative", "스토리텔링", "내러티브", "편집", "사운드 디자인", "포스트프로덕션", "저작권", "레퍼런스", "컷"],
      weekTopics: [
        "Course Introduction & AI 기반 영상 제작 워크플로 이해",
        "영상 제작의 역사와 생성형 AI의 발전",
        "AI 협업 영상 제작을 위한 스토리텔링·내러티브 구조 설계",
        "이미지·영상 생성을 위한 프롬프트 엔지니어링",
        "비주얼 컨셉 개발을 위한 생성형 AI 도구 활용",
        "AI 기반 이미지 생성과 비주얼 스타일 탐색",
        "AI 영상 생성: 씬 구성과 모션 디자인",
        "Midterm Project Presentation",
        "AI 기반 편집: 셀렉·정제·시퀀스 설계",
        "AI 도구를 활용한 포스트프로덕션 워크플로",
        "사운드 디자인과 오디오 통합",
        "감정 흐름 설계와 관객 경험 기획",
        "AI 생성 콘텐츠의 저작권·윤리·창작자 정체성",
        "AI 협업 영상 제작 사례 연구",
        "Final Project 개발 및 개별 피드백",
        "Final Project Presentation"
      ],
      weekMarks: { 8: "중간 발표", 16: "최종 발표" }
    },
    {
      id: "networking",
      name: "컴퓨터 네트워킹",
      en: "Computer Networking",
      code: "EC4206-01",
      prof: "Suman Pandey (수만 판데)",
      credits: "3/0/3",
      color: "#CFDC86",
      sttLang: "en-US",
      book: "Kurose & Ross, Computer Networking: A Top Down Approach",
      grading: [
        ["중간", 30], ["기말", 30], ["과제", 30], ["출석", 10]
      ],
      meetings: [
        { day: 2, start: "13:00", end: "14:30", room: "지스트대학 C동 110" },
        { day: 4, start: "13:00", end: "14:30", room: "지스트대학 C동 110" }
      ],
      keywords: ["HTTP", "DNS", "CDN", "socket", "SNMP", "NAT", "firewall", "load balancer", "caching", "TCP", "packet tracer", "OSPF", "BGP", "RIP", "multicast", "WireShark"],
      weekTopics: [
        "Computer Networks and the Internet Protocol (IP)",
        "Application Layer (Web HTTP, RESTful)",
        "Application Layer (DNS, Video Streaming, CDN)",
        "Application Layer (Socket Programming)",
        "Application Layer (Network Management SNMP/NetConf)",
        "MiddleBox (Firewall, NAT)",
        "MiddleBox (Load balancer, Caching)",
        "MidTerm",
        "Transport Layer (TCP briefly)",
        "Cisco Packet Tracer",
        "Network Layer (Network Devices)",
        "Network Layer (Data Plane)",
        "Network Layer (Control Plane)",
        "Network Layer (OSPF, RIP, BGP)",
        "Broadcast · Multicast",
        "FinalTerm"
      ],
      weekMarks: { 2: "WireShark HTTP", 3: "WireShark DNS", 4: "ChatBot", 5: "SNMP 설치", 6: "Middleware", 8: "중간고사", 10: "Packet Tracer", 16: "기말고사" }
    },
    {
      id: "visualization",
      name: "기초시각화",
      en: "Fundamentals of Visualization",
      code: "EC4218-02",
      prof: "Brian J. d'Auriol (브라이언 도리얼)",
      credits: "3/0/3",
      color: "#A6DCC0",
      sttLang: "en-US",
      book: "d'Auriol, Fundamentals of Visualization — A Morphosemantic Approach (강의 슬라이드) / Ware, Information Visualization 3rd Ed.",
      grading: [["프로젝트", 100]],
      note: "성적 100% 프로젝트. 산출물 = 문서 + 공개 데모 또는 논문 제출. 3주차에 term project 시작.",
      meetings: [
        { day: 2, start: "10:30", end: "12:00", room: "지스트대학 A동 108" },
        { day: 4, start: "10:30", end: "12:00", room: "지스트대학 A동 108" }
      ],
      keywords: ["ParaView", "Blender", "semiotics", "color model", "CIE", "RGB", "HSL", "perception", "morphosemantics", "scientific visualization", "graphics pipeline", "term project"],
      weekTopics: [
        "Visualization roots: 구석기·신석기 시각 작업, Peircean 기호학, 모션 분해",
        "정보 조직의 필요와 시각화 (수메르~르네상스~근대), 표·다변량·불확실성",
        "Pre-computerized visualization: 뒤러 1515 성도 등 사례 분석",
        "Visualization walk-throughs (한국 지리·인구·기상, 세계 성불평등지수)",
        "The human eye (photoreceptors; photopic/mesopic/scotopic, luminosity)",
        "The human brain (visual cortex, frontal cortex, amygdala; visual pathways)",
        "Color models (CIE, standard observer, RGB, HSL)",
        "midterm exam week — no lectures",
        "지각 기반 한계 (Chromostereopsis, preattentive overloading)",
        "Visualization Morphology (시스템, 미디어 생성, 컴포넌트화)",
        "Morphosemantics: 시지각 컴포넌트화와 Q&A 정식화",
        "Morphosemantics: 이해·지식 시각화 메트릭",
        "Applications to Scientific visualization",
        "Applications to Information visualization",
        "Visual analytics 입문, Graphics Pipeline의 역할",
        "Final exam week — no lectures"
      ],
      weekMarks: { 1: "ParaView·Blender 설치", 2: "Ch.1 숙련 시작", 3: "term project 시작", 4: "Ch.1 숙련 제출", 8: "휴강", 15: "term project 마감", 16: "휴강" }
    },
    {
      id: "piano",
      name: "피아노",
      en: "Piano",
      code: "GS0201-02",
      prof: "박상희",
      credits: "2/0/0",
      color: "#EFCF86",
      sttLang: "ko-KR",
      book: "기초: Bayer / Czerny / Burgmüller · 중급 이상: 자유 선택",
      grading: [["출석 및 태도", 50], ["과제", 50]],
      note: "수업에서 다룰 악보는 본인이 지참(필기 가능 상태). 공지는 LMS.",
      meetings: [
        { day: 4, start: "17:30", end: "19:30", room: "지스트대학 A동 103" }
      ],
      keywords: ["음계", "조표", "셈여림", "아티큘레이션", "페달", "템포", "운지", "레퍼토리"],
      weekTopics: [
        "오리엔테이션: 강의 소개",
        "피아노 레퍼토리 연구",
        "악보 이해하기 1: 독보의 기초 및 운지",
        "악보 이해하기 2: 음자리표와 덧줄",
        "악보 이해하기 3: 음계와 조표",
        "악보 이해하기 4: 음악 용어, 빠르기 말, 셈여림",
        "악보 이해하기 5: 여러 가지 음악 기호와 연주법",
        "피아노 음악의 역사와 진화",
        "중간고사",
        "기본 테크닉 1: 기본 음계 (Scales)",
        "기본 테크닉 2: 악상 (Dynamics)",
        "기본 테크닉 3: 리듬과 템포",
        "기본 테크닉 4: 아티큘레이션",
        "기본 테크닉 5: 페달 테크닉",
        "작품 심화 연구",
        "기말고사"
      ],
      weekMarks: { 9: "중간고사", 16: "기말고사" }
    }
  ]
};

/* ── 지난 학기 성적 (성적증명서 기준, S = Pass/무등급) ─────── */
window.ARCHIVES = {
  "1-1": {
    earned: 18,
    gpa: "3.84/4.5",
    courses: [
      { code: "GS0110", name: "헬스", credits: 0, grade: "S" },
      { code: "GS1001", name: "미적분학과 응용", credits: 3, grade: "A0" },
      { code: "GS1101", name: "일반물리학및연습I", credits: 3, grade: "B+" },
      { code: "GS1111", name: "일반물리학실험I", credits: 1, grade: "A+" },
      { code: "GS1201", name: "일반화학및연습I", credits: 3, grade: "B0" },
      { code: "GS1512", name: "글쓰기의기초:학술적글쓰기", credits: 3, grade: "A0" },
      { code: "GS1901", name: "GIST새내기", credits: 1, grade: "S" },
      { code: "GS2704", name: "기업과사회I", credits: 3, grade: "A+" },
      { code: "UC0901", name: "과학기술과경제", credits: 1, grade: "S" }
    ]
  },
  "1-2": {
    earned: 19,
    gpa: "3.94/4.5",
    note: "GS2001·GS2823 성적은 증명서 도장에 가려 합계(67.0) 역산값 — 원본 확인 필요",
    courses: [
      { code: "GS0213", name: "컴퓨터음악만들기", credits: 0, grade: "S" },
      { code: "GS1211", name: "일반화학실험I", credits: 1, grade: "B0" },
      { code: "GS1401", name: "컴퓨터프로그래밍", credits: 3, grade: "A0" },
      { code: "GS1603", name: "영어I:발표와토론", credits: 2, grade: "A+" },
      { code: "GS2001", name: "다변수해석학과응용", credits: 3, grade: "A0" },
      { code: "GS2822", name: "AI와나", credits: 2, grade: "B+" },
      { code: "GS2823", name: "수학의위대한순간들-AI", credits: 3, grade: "A0" },
      { code: "GS2833", name: "비판적디자인", credits: 3, grade: "A0" },
      { code: "UC0202", name: "창의함양", credits: 1, grade: "S" },
      { code: "UC0902", name: "GIST전공탐색", credits: 1, grade: "S" }
    ]
  },
  "2-1": {
    earned: 17,
    gpa: "3.61/4.5",
    courses: [
      { code: "EC2202", name: "자료구조", credits: 3, grade: "A0" },
      { code: "EC2203", name: "디지털설계", credits: 3, grade: "A0" },
      { code: "GS0112", name: "수영", credits: 0, grade: "S" },
      { code: "GS2004", name: "선형대수학과응용", credits: 3, grade: "B+" },
      { code: "GS2652", name: "영어II:이공계글쓰기입문", credits: 2, grade: "B0" },
      { code: "GS2809", name: "아름다운지구", credits: 3, grade: "B0" },
      { code: "GS2824", name: "문명과수학", credits: 3, grade: "A0" },
      { code: "UC9331", name: "GIST대학콜로퀴움", credits: 0, grade: "S" }
    ]
  },
  "2-summer": {
    earned: 1,
    note: "GPA 미산입",
    courses: [
      { code: "GS0700", name: "세미나<몰입캠프:프로그래밍과스타트업>(KAIST)", credits: 1, grade: "S" }
    ]
  },
  "2-2": {
    earned: 16,
    gpa: "4.16/4.5",
    courses: [
      { code: "AI2002", name: "디지털유니버스콜로퀴움", credits: 1, grade: "S" },
      { code: "EC2206", name: "알고리즘개론", credits: 3, grade: "A+" },
      { code: "GS0108", name: "힙합댄스", credits: 0, grade: "S" },
      { code: "GS1496", name: "(MOOC)기계학습을위한수학:선형대수학", credits: 1, grade: "S" },
      { code: "GS2420", name: "(MOOC)알고리즘기반논리적사고-기초", credits: 1, grade: "S" },
      { code: "GS2421", name: "(MOOC)알고리즘기반논리적사고-심화", credits: 1, grade: "S" },
      { code: "GS2795", name: "문명으로보는21세기", credits: 3, grade: "A0" },
      { code: "GS2797", name: "꿈의사회학", credits: 3, grade: "A0" },
      { code: "GS3401", name: "(MOOC)프론트엔드웹개발", credits: 2, grade: "S" },
      { code: "UC0201", name: "사회봉사", credits: 1, grade: "S" }
    ]
  },
  "3-1": {
    earned: 19,
    gpa: "4.15/4.5",
    courses: [
      { code: "AI5302", name: "딥러닝", credits: 3, grade: "A0" },
      { code: "CT5104", name: "사운드디자인과프로그래밍", credits: 3, grade: "A+" },
      { code: "EC2107", name: "기초공학수학", credits: 3, grade: "A+" },
      { code: "EC3102", name: "컴퓨터시스템이론및실험", credits: 4, grade: "A0" },
      { code: "EC3216", name: "오토마타이론", credits: 3, grade: "B+" },
      { code: "HS2544", name: "문화콘텐츠의이해", credits: 3, grade: "A+" },
      { code: "UC9331", name: "GIST대학콜로퀴움", credits: 0, grade: "S" }
    ]
  },
  "3-summer": {
    earned: 6,
    note: "계절학기 — 등급은 표기되지만 전체 평점(GPA) 계산에는 미산입",
    courses: [
      { code: "", name: "이산수학", credits: 3, grade: "B+" },
      { code: "", name: "인공지능", credits: 3, grade: "A0" }
    ]
  }
};
