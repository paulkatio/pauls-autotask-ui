import {
  CompanyDetailContent,
  companyMetadata,
} from "@/components/companies/company-detail-content";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return companyMetadata(Number(id));
}

// Kundenakte im eigenen Browser-Fenster (Pop-out), OHNE Sidebar. KPI-Kacheln/Tabs
// bleiben im Popup (basePath=/popup/companies).
export default async function PopupCompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; cursor?: string; q?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  return (
    <CompanyDetailContent
      companyId={Number(id)}
      tabParam={sp.tab}
      cursor={sp.cursor}
      q={sp.q}
      basePath="/popup/companies"
      showBackLink={false}
    />
  );
}
