import { getLanguage } from "@/core/queries/getLanguage";
import {
  JuntoExpressionReference,
  ExpressionTypes,
  ExpressionUIIcons,
} from "@/store/types";
import { LinkExpression } from "@perspect3vism/ad4m";

///NOTE: this function wont work in current setup and its still undecided if we want expression language hints on the perspective meta
///This behaviour should likely be deleted and achieved some other way
export async function getTypedExpressionLanguages(
  links: LinkExpression[],
  storeLanguageUI: boolean
): Promise<[JuntoExpressionReference[], ExpressionUIIcons[]]> {
  const typedExpressionLanguages = [];
  const uiIcons = [];
  //Get and cache the expression UI for each expression language
  //And used returned expression language names to populate typedExpressionLanguages field
  for (const link of links) {
    if (link.data.predicate == "language") {
      const languageRes = await getLanguage(link.data.target!);
      if (!languageRes) {
        throw Error(
          `Could not find language with address: ${link.data.target}`
        );
      }
      if (storeLanguageUI) {
        const uiData: ExpressionUIIcons = {
          languageAddress: link.data.target!,
          createIcon: languageRes.constructorIcon?.code || "",
          viewIcon: languageRes.icon?.code || "",
          name: languageRes.name!,
        };
        uiIcons.push(uiData);
      }
      let expressionType;
      if (languageRes.name!.endsWith("shortform-expression")) {
        expressionType = ExpressionTypes.ShortForm;
      } else if (languageRes.name!.endsWith("group-expression")) {
        expressionType = ExpressionTypes.GroupExpression;
      } else if (languageRes.name!.endsWith("profile-expression")) {
        expressionType = ExpressionTypes.ProfileExpression;
      } else {
        expressionType = ExpressionTypes.Other;
      }
      typedExpressionLanguages.push({
        languageAddress: link.data.target!,
        expressionType: expressionType,
      } as JuntoExpressionReference);
    }
  }
  return [typedExpressionLanguages, uiIcons];
}
