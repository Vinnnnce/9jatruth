import { TruthPostDetail } from "@/components/truth-post-detail";

/**
 * /truths/[id] — full post detail (image-1 design) shown when a user
 * clicks a post in the feed. All engagement actions are wired to live APIs.
 */
export const dynamic = "force-dynamic";

export default async function TruthDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const truthId = Number(id);
  if (!Number.isFinite(truthId) || truthId <= 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-lg font-semibold text-[#D6B06C]">Invalid post</p>
      </div>
    );
  }
  return <TruthPostDetail truthId={truthId} />;
}
