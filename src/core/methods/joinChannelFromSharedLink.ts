import { ChannelState, FeedType, MembraneType } from "@/store";
import { installSharedPerspective } from "@/core/mutations/installSharedPerspective";
import { getTypedExpressionLanguages } from "@/core/methods/getTypedExpressionLangs";

export async function joinChannelFromSharedLink(
  sharedPerspectiveUrl: string
): Promise<ChannelState> {
  try {
    const installedChannelPerspective = await installSharedPerspective(
      sharedPerspectiveUrl
    );
    console.log(
      new Date(),
      "Installed with SharedPerspective result",
      installedChannelPerspective
    );

    const typedExpressionLanguages = await getTypedExpressionLanguages(
      installedChannelPerspective.sharedPerspective!,
      false
    );
    //TODO: derive membraneType from link on sharedPerspective
    //For now its hard coded inherited since we dont support anything else
    const now = new Date();
    //TODO: lets use a constructor on the ChannelState type
    return {
      name: installedChannelPerspective.name!,
      hasNewMessages: false,
      perspective: installedChannelPerspective.uuid!,
      type: FeedType.Signaled,
      createdAt: now,
      linkLanguageAddress:
        installedChannelPerspective.sharedPerspective!.linkLanguages![0]!
          .address!,
      currentExpressionLinks: {},
      currentExpressionMessages: {},
      sharedPerspectiveUrl: sharedPerspectiveUrl,
      membraneType: MembraneType.Inherited,
      groupExpressionRef: "",
      typedExpressionLanguages: typedExpressionLanguages,
    };
  } catch (error) {
    throw new Error(error);
  }
}
