import { ChannelState, FeedType, MembraneType } from "@/store";
import { ad4mClient } from "@/app";
import { getTypedExpressionLanguages } from "@/core/methods/getTypedExpressionLangs";

export async function joinChannelFromSharedLink(
  url: string
): Promise<ChannelState> {
  console.log("Starting sharedperspective join");
  const joinNeighbourhood = await ad4mClient.neighbourhood.joinFromUrl(url);
  console.log(
    new Date(),
    "Joined neighbourhood with result",
    joinNeighbourhood
  );

  const perspectiveSnapshot = await ad4mClient.perspective.snapshotByUUID(joinNeighbourhood.uuid);

  const typedExpressionLanguages = await getTypedExpressionLanguages(
    perspectiveSnapshot!,
    false
  );

  //Read out metadata about the perspective from the meta
  let name;
  for (const link of perspectiveSnapshot!.links) {
    if (link.data.predicate == "rdf://name") {
      name = link.data.target
    };
  };

  //TODO: derive membraneType from link on sharedPerspective
  //For now its hard coded inherited since we dont support anything else
  const now = new Date();
  //TODO: lets use a constructor on the ChannelState type
  return {
    name: name,
    hasNewMessages: false,
    perspective: joinNeighbourhood.uuid,
    type: FeedType.Signaled,
    createdAt: now,
    linkLanguageAddress: "na",
    currentExpressionLinks: {},
    currentExpressionMessages: {},
    sharedPerspectiveUrl: url,
    membraneType: MembraneType.Inherited,
    groupExpressionRef: "",
    typedExpressionLanguages: typedExpressionLanguages,
    notifications: {
      mute: false,
    },
  } as ChannelState;
}
