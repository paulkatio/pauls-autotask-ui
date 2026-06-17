import {
  FiltersSkeleton,
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton />
      <FiltersSkeleton search filters={2} />
      <TableSkeleton columns={5} rows={10} breakpoint="xl" minWidthClass="min-w-3xl" />
    </div>
  );
}
