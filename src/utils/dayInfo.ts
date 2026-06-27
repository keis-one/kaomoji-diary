const DAY_JA = ['日', '月', '火', '水', '木', '金', '土']
const DAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const getDayOfWeek = (dateStr: string, language: string): string => {
  const d = new Date(dateStr + 'T00:00:00')
  return language === 'ja' ? DAY_JA[d.getDay()] : DAY_EN[d.getDay()]
}

// 固定の MM-DD 記念日・祝日リスト（変動祝日は除く）
const WHAT_DAY_JA: Record<string, string> = {
  '01-01': '元日',
  '01-07': '七草の日',
  '01-11': '鏡開き',
  '02-03': '節分',
  '02-11': '建国記念の日',
  '02-14': 'バレンタインデー',
  '02-22': '猫の日',
  '02-23': '天皇誕生日',
  '03-03': 'ひな祭り',
  '03-08': '国際女性デー',
  '03-14': 'ホワイトデー',
  '03-20': '国際幸福デー',
  '04-01': 'エイプリルフール',
  '04-22': 'アースデー',
  '04-29': '昭和の日',
  '05-03': '憲法記念日',
  '05-04': 'みどりの日',
  '05-05': 'こどもの日',
  '05-12': '看護の日',
  '06-01': '気象記念日',
  '06-05': '世界環境デー',
  '07-07': '七夕',
  '08-06': '広島原爆の日',
  '08-11': '山の日',
  '08-15': '終戦記念日',
  '09-01': '防災の日',
  '09-09': '重陽の節句',
  '10-01': '国際高齢者デー',
  '10-10': '目の愛護デー',
  '10-31': 'ハロウィン',
  '11-01': '犬の日',
  '11-03': '文化の日',
  '11-11': '電池の日',
  '11-15': '七五三',
  '11-23': '勤労感謝の日',
  '12-25': 'クリスマス',
  '12-31': '大晦日',
}

const WHAT_DAY_EN: Record<string, string> = {
  '01-01': "New Year's Day",
  '02-11': 'National Foundation Day',
  '02-14': "Valentine's Day",
  '02-22': 'Cat Day',
  '02-23': "Emperor's Birthday",
  '03-03': 'Hinamatsuri',
  '03-08': "International Women's Day",
  '03-14': 'White Day',
  '03-20': 'International Day of Happiness',
  '04-01': "April Fools' Day",
  '04-22': 'Earth Day',
  '04-29': 'Showa Day',
  '05-03': 'Constitution Day',
  '05-04': 'Greenery Day',
  '05-05': "Children's Day",
  '06-05': 'World Environment Day',
  '07-07': 'Tanabata',
  '08-11': 'Mountain Day',
  '08-15': 'End of WWII',
  '09-01': 'Disaster Prevention Day',
  '10-31': 'Halloween',
  '11-03': 'Culture Day',
  '11-23': 'Labour Thanksgiving Day',
  '12-25': 'Christmas',
  '12-31': "New Year's Eve",
}

export const getWhatDay = (dateStr: string, language: string): string | null => {
  const mmdd = dateStr.slice(5)
  const map = language === 'ja' ? WHAT_DAY_JA : WHAT_DAY_EN
  return map[mmdd] ?? null
}
