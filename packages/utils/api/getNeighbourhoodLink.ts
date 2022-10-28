import retry from "../helpers/retry";
import { LinkQuery, Literal } from "@perspect3vism/ad4m";
import { findLink, mapLiteralLinks } from "../helpers/linkHelpers";
import {
  CARD_HIDDEN,
  DESCRIPTION,
  NAME,
} from "../constants/communityPredicates";
import { getAd4mClient } from "@perspect3vism/ad4m-connect/dist/utils";

export interface Payload {
  perspectiveUuid: string;
  messageUrl: string;
  message: Object;
  isHidden: boolean;
}

export function findNeighbourhood(str: string) {
  const URIregexp =
    /(?<=\<span data-mention="neighbourhood"\>)(.|\n)*?(?=<\/span\>)/gm;
  const URLregexp = /<a[^>]+href=\"(.*?)\"[^>]*>(.*)?<\/a>/gm;
  const uritokens = Array.from(str.matchAll(URIregexp));
  const urlTokens = Array.from(str.matchAll(URLregexp));

  const urifiltered = [];
  const urlfiltered = [];

  const urlRex =
    /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/;
  for (const match of uritokens) {
    if (!urlRex.test(match[0])) {
      urifiltered.push(match[0]);
    }
  }

  for (const match of urlTokens) {
    urlfiltered.push(match[1]);
  }

  return [urifiltered, urlfiltered];
}

export default async function ({ message, isHidden }: Payload) {
  try {
    const client = await getAd4mClient();

    // @ts-ignore
    const [neighbourhoods] = findNeighbourhood(message);

    const hoods = [];

    if (!isHidden) {
      for (const neighbourhood of neighbourhoods) {
        const exp = await client.expression.get(neighbourhood);
        const links = JSON.parse(exp.data).meta.links;

        const perspectives = await client.perspective.all();
        const perspectiveUuid = perspectives.find(
          (e) => e.sharedUrl === neighbourhood
        )?.uuid;

        const { name, description } = mapLiteralLinks(links, {
          name: NAME,
          description: DESCRIPTION,
        });

        hoods.push({
          type: "neighbourhood",
          name,
          description,
          url: neighbourhood || "",
          perspectiveUuid,
        });
      }
    }

    return hoods;
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function getNeighbourhoodCardHidden({
  perspectiveUuid,
  messageUrl,
}) {
  try {
    const client = await getAd4mClient();

    const isHidden = await retry(
      async () => {
        return await client.perspective.queryLinks(
          perspectiveUuid,
          new LinkQuery({
            source: messageUrl,
            predicate: CARD_HIDDEN,
          })
        );
      },
      { defaultValue: [] }
    );

    return isHidden.length === 0;
  } catch (e: any) {
    throw new Error(e);
  }
}
