// [게임 UI i18n] 게임 내부 UI(버튼·안내·결과)에서 반복되는 문구의 다국어 사전.
// 각 게임은 langA(학생 본인 언어)로 gt(UI.key, langA) 를 호출해 표시한다.
// lib/i18n.ts 를 건드리지 않기 위해 게임 전용으로 분리(공유 파일 충돌 방지).
//
// 정책: ko/en/vi/zh/fil 5개는 자연스럽게, 그 외 언어는 가능한 만큼 채우고
// 없으면 gt() 가 en → 첫 값으로 폴백한다.

export type LangMap = Partial<Record<string, string>>;

// 외국어로 표시될 때는 한국어 원문을 병기한다 — 다문화 학생의 한국어 적응을
// 돕는 도구이므로 게임 UI 라벨에서도 한국어를 항상 함께 노출 (lib/i18n.ts 와 동일 정책).
// 게임 콘텐츠(단어·문항, lib/gameData tr())는 게임성이 깨지므로 병기하지 않는다.
export function gt(map: LangMap, lang: string): string {
  const raw = map[lang] ?? map.en ?? map.ko ?? Object.values(map)[0] ?? "";
  if (lang === "ko") return raw;
  const ko = (map.ko ?? "").trim();
  if (!ko || raw.trim() === ko || raw.includes(ko)) return raw;
  return `${raw} (${ko})`;
}

export const UI: Record<string, LangMap> = {
  start: {
    ko: "시작", en: "Start", vi: "Bắt đầu", zh: "开始", fil: "Magsimula",
    ja: "スタート", th: "เริ่ม", id: "Mulai", ru: "Старт", hi: "शुरू", ar: "ابدأ",
    mn: "Эхлэх", uz: "Boshlash", km: "ចាប់ផ្តើម", my: "စတင်",
  },
  playAgain: {
    ko: "다시 하기", en: "Play again", vi: "Chơi lại", zh: "再玩一次", fil: "Ulitin",
    ja: "もう一度", th: "เล่นอีกครั้ง", id: "Main lagi", ru: "Ещё раз", hi: "फिर खेलें", ar: "العب مجددًا",
    mn: "Дахин", uz: "Yana", km: "លេងម្តងទៀត", my: "ထပ်ကစား",
  },
  restart: {
    ko: "다시 시작", en: "Restart", vi: "Bắt đầu lại", zh: "重新开始", fil: "Magsimula muli",
    ja: "やり直す", th: "เริ่มใหม่", id: "Mulai ulang", ru: "Заново", hi: "फिर से", ar: "إعادة",
  },
  win: {
    ko: "승리!", en: "Win!", vi: "Thắng!", zh: "胜利!", fil: "Panalo!",
    ja: "勝ち!", th: "ชนะ!", id: "Menang!", ru: "Победа!", hi: "जीत!", ar: "فوز!",
  },
  draw: {
    ko: "무승부", en: "Draw", vi: "Hòa", zh: "平局", fil: "Tabla",
    ja: "引き分け", th: "เสมอ", id: "Seri", ru: "Ничья", hi: "बराबर", ar: "تعادل",
  },
  round: {
    ko: "라운드", en: "Round", vi: "Vòng", zh: "回合", fil: "Round",
    ja: "ラウンド", th: "รอบ", id: "Babak", ru: "Раунд", hi: "राउंड", ar: "جولة",
  },
  score: {
    ko: "점수", en: "Score", vi: "Điểm", zh: "得分", fil: "Iskor",
    ja: "スコア", th: "คะแนน", id: "Skor", ru: "Счёт", hi: "अंक", ar: "النقاط",
  },
  replay: {
    ko: "다시 듣기", en: "Replay", vi: "Nghe lại", zh: "重听", fil: "Ulitin",
    ja: "もう一度聞く", th: "ฟังอีกครั้ง", id: "Putar lagi", ru: "Повтор", hi: "फिर सुनो", ar: "إعادة الاستماع",
  },
  correct: {
    ko: "정답!", en: "Correct!", vi: "Đúng rồi!", zh: "答对了!", fil: "Tama!",
    ja: "正解!", th: "ถูกต้อง!", id: "Benar!", ru: "Верно!", hi: "सही!", ar: "صحيح!",
  },
  wrong: {
    ko: "오답", en: "Wrong", vi: "Sai rồi", zh: "答错了", fil: "Mali",
    ja: "不正解", th: "ผิด", id: "Salah", ru: "Неверно", hi: "गलत", ar: "خطأ",
  },
  ready: {
    ko: "준비", en: "Ready", vi: "Sẵn sàng", zh: "准备", fil: "Handa",
    ja: "じゅんび", th: "พร้อม", id: "Siap", ru: "Готов", hi: "तैयार", ar: "استعد",
  },
  next: {
    ko: "다음", en: "Next", vi: "Tiếp", zh: "下一个", fil: "Susunod",
    ja: "つぎ", th: "ถัดไป", id: "Lanjut", ru: "Далее", hi: "अगला", ar: "التالي",
  },
  finish: {
    ko: "끝!", en: "Finish!", vi: "Kết thúc!", zh: "结束!", fil: "Tapos!",
    ja: "おわり!", th: "จบ!", id: "Selesai!", ru: "Конец!", hi: "खत्म!", ar: "انتهى!",
  },
  submit: {
    ko: "제출", en: "Submit", vi: "Gửi", zh: "提交", fil: "Isumite",
    ja: "ていしゅつ", th: "ส่ง", id: "Kirim", ru: "Отправить", hi: "जमा करो", ar: "إرسال",
  },
  allDone: {
    ko: "모두 끝났어요!", en: "All done!", vi: "Xong hết rồi!", zh: "全部完成!",
    fil: "Tapos na lahat!", ja: "ぜんぶおわり!", th: "เสร็จหมดแล้ว!", id: "Semua selesai!",
    ru: "Всё готово!", hi: "सब हो गया!", ar: "تم كل شيء!",
  },
  players: {
    ko: "인원", en: "Players", vi: "Số người", zh: "人数", fil: "Manlalaro",
    ja: "にんずう", th: "ผู้เล่น", id: "Pemain", ru: "Игроки", hi: "खिलाड़ी", ar: "اللاعبون",
  },
  difficulty: {
    ko: "난이도", en: "Difficulty", vi: "Độ khó", zh: "难度", fil: "Antas",
    ja: "なんいど", th: "ระดับ", id: "Tingkat", ru: "Уровень", hi: "कठिनाई", ar: "المستوى",
  },
};
