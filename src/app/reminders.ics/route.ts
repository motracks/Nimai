import { NextResponse, type NextRequest } from "next/server";
import { getInstrumentStatuses } from "@/lib/progress";
import { calendarEvents, toICS } from "@/lib/reminders";

// A calendar file with the signed-in user's next retake dates and the next
// four season changes. Importing it into a phone calendar gives reminders
// without Nimai having to send email or push notifications.
export async function GET(request: NextRequest) {
  const { user, latestAt } = await getInstrumentStatuses();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const ics = toICS(calendarEvents(latestAt, request.nextUrl.origin));
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="nimai-reminders.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}
