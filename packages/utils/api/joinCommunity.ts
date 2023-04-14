import { Community } from "../types";
import { getAd4mClient } from "@perspect3vism/ad4m-connect/utils";
import CommunityModel from "./community";
import { getMetaFromLinks } from "../helpers";
import { Ad4mClient } from "@perspect3vism/ad4m";
import { SubjectRepository } from "../factory";
import { Member } from "./member";

export interface Payload {
  joiningLink: string;
}

export default async ({ joiningLink }: Payload): Promise<Community> => {
  try {
    const client: Ad4mClient = await getAd4mClient();
    const agent = await client.agent.me();
    const allPerspectives = await client.perspective.all();

    const exsistingPerspective = allPerspectives.find((perspective) => {
      perspective.sharedUrl === joiningLink;
    });

    if (exsistingPerspective) {
      throw Error("Neighbourhood already joined!");
    }

    const perspective = await client.neighbourhood.joinFromUrl(joiningLink);

    const neighbourhoodMeta = getMetaFromLinks(
      perspective.neighbourhood!.meta.links
    );


    return {
      uuid: perspective!.uuid,
      author: neighbourhoodMeta.author!,
      timestamp: neighbourhoodMeta.timestamp!,
      name: neighbourhoodMeta.name,
      description:
        neighbourhoodMeta.description || "",
      image: "",
      thumbnail: "",
      neighbourhoodUrl: perspective.sharedUrl!,
      members: [agent.did],
      id: ""
    };
  } catch (e) {
    throw new Error(e);
  }
};

