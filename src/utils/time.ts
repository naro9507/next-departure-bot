export type DayType = "weekday" | "saturday" | "holiday";

export interface JSTTime {
	hour: number;
	minute: number;
	dayType: DayType;
}

export function getJSTTime(): JSTTime {
	const now = new Date();
	// JST = UTC + 9 hours
	const jstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000);

	const hour = jstDate.getUTCHours();
	const minute = jstDate.getUTCMinutes();
	const day = jstDate.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat

	let dayType: DayType;
	if (day === 0) dayType = "holiday"; // Sunday
	else if (day === 6) dayType = "saturday"; // Saturday
	else dayType = "weekday";

	return { hour, minute, dayType };
}

// 24:38 → "24:38(翌日)" のような表示
export function formatTime(hour: number, minute: number): string {
	const h = hour % 24;
	const suffix = hour >= 24 ? "(翌日)" : "";
	return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}${suffix}`;
}
