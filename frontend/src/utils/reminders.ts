/** 하루 마무리·주간 일지를 저장했을 때 오른쪽 위 알림을 바로 다시 확인하게 보내는 이벤트(1-4f ⑬) */
export const REMINDER_REFRESH = 'reminders:refresh'
export const refreshReminders = () => window.dispatchEvent(new Event(REMINDER_REFRESH))
