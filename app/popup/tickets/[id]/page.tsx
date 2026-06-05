import {
  TicketDetailContent,
  ticketMetadata,
} from "@/components/tickets/ticket-detail-content";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return ticketMetadata(Number(id));
}

// Ticketdetail im eigenen Browser-Fenster (Pop-out), OHNE Sidebar.
export default async function PopupTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TicketDetailContent id={Number(id)} />;
}
