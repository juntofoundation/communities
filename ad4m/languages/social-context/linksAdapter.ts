import type Expression from "@perspect3vism/ad4m/Expression";
import type {
  LinksAdapter,
  NewLinksObserver,
} from "@perspect3vism/ad4m/Language";
import type Agent from "@perspect3vism/ad4m/Agent";
import type { HolochainLanguageDelegate } from "@perspect3vism/ad4m/LanguageContext";
import type LanguageContext from "@perspect3vism/ad4m/LanguageContext";
import { DNA_NICK } from "./dna";
import type { LinkQuery } from "@perspect3vism/ad4m/Links";
import { link } from "fs";

export class JuntoSocialContextLinkAdapter implements LinksAdapter {
  socialContextDna: HolochainLanguageDelegate;

  constructor(context: LanguageContext) {
    //@ts-ignore
    this.socialContextDna = context.Holochain as HolochainLanguageDelegate;
  }

  writable(): boolean {
    return true;
  }

  public(): boolean {
    return false;
  }

  async others(): Promise<Agent[]> {
    return await this.socialContextDna.call(
      DNA_NICK,
      "social_context",
      "get_others",
      {}
    );
  }

  async addLink(link: Expression): Promise<void> {
    const data = prepareExpressionLink(link);
    await this.socialContextDna.call(DNA_NICK, "social_context", "add_link", data);
  }

  async updateLink(
    oldLinkExpression: Expression,
    newLinkExpression: Expression
  ): Promise<void> {
    const source_link = prepareExpressionLink(oldLinkExpression);
    const target_link = prepareExpressionLink(newLinkExpression);
    await this.socialContextDna.call(
      DNA_NICK,
      "social_context",
      "update_link",
      { source: source_link, target: target_link }
    );
  }

  async removeLink(link: Expression): Promise<void> {
    const data = prepareExpressionLink(link);
    await this.socialContextDna.call(
      DNA_NICK,
      "social_context",
      "remove_link",
      data
    );
  }

  async getLinks(query: LinkQuery): Promise<Expression[]> {
    const link_query = Object.assign(query);
    if (!link_query.source) {
      link_query.source = "root";
    }
    if (link_query.source == undefined) {
      link_query.source = null;
    }
    if (link_query.target == undefined) {
      link_query.target = null;
    }
    if (link_query.predicate == undefined) {
      link_query.predicate = null;
    }
    if (link_query.fromDate) {
      link_query.fromDate = link_query.fromDate.toISOString();
    }
    if (link_query.untilDate) {
      link_query.untilDate = link_query.untilDate.toISOString();
    }
    link_query.limit = 0;
    console.debug("Holochain Social Context: Getting Links With: ", link_query);
    const links = await this.socialContextDna.call(
      DNA_NICK,
      "social_context",
      "get_links",
      link_query
    );
    //links.sort((val1, val2) => val1.timestamp - val2.timestamp);
    //console.debug("Holchain Social Context: Got Links", links);

    return links;
  }

  addCallback(callback: NewLinksObserver): number {
    return 0;
  }
}

function prepareExpressionLink(link: Expression): object {
  const data = Object.assign(link);
  if (data.data.source == "") {
    data.data.source = null;
  }
  if (data.data.target == "") {
    data.data.target = null;
  }
  if (data.data.predicate == "") {
    data.data.predicate = null;
  }
  return data;
}
