import { CommunityDetailsView } from "@/components/community-details-view"

export default async function CommunityDetailsPage({
  params,
}: {
  params: Promise<{ communityId: string }>
}) {
  const { communityId } = await params

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <CommunityDetailsView communityId={communityId} />
    </main>
  )
}
