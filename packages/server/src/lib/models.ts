import {openai} from "@ai-sdk/openai"
import {openrouter} from "@openrouter/ai-sdk-provider"
import {
    findSupportedChatModel,
    type SupportedChatModel,
    type SupportedChatModelId,
    type SupportedProvider,
    
} from "@KL-CODE/shared"

import type { LanguageModel } from "ai";

type OpenAIModelId=Extract<SupportedChatModel,{provider:"openai"}>["id"];
type OpenRouterModelId=Extract<SupportedChatModel,{provider:"openrouter"}>["id"];

export type ResolvedModel ={
    model:LanguageModel;
    provider:SupportedProvider;
    modelId: SupportedChatModelId;
}

function assertUnsupportedProvider(provider:never): never {
    throw new Error(`Unsupported provider: ${provider}`);
};

function resolveOpenAIModel(modelId:OpenAIModelId): ResolvedModel {
    return {
        model:openai(modelId),
        provider:"openai",
        modelId,
    }
}

function resolveOpenRouterModel(modelId:OpenRouterModelId): ResolvedModel {
    return {
        model:openrouter(modelId),
        provider:"openrouter",
        modelId,
    }
}

function resolveSupportedChatModel(model:SupportedChatModel):ResolvedModel {
    const provider = model.provider

    switch (provider) {
        case "openai":
            return resolveOpenAIModel(model.id)
        case "openrouter":
            return resolveOpenRouterModel(model.id)
        default:
            return assertUnsupportedProvider(provider);

    }
}
export function isSupportedChatModel(modelId:string):modelId is SupportedChatModelId {
    return findSupportedChatModel(modelId)!=null;
}

export function resolveChatModel(modelId:string): ResolvedModel {
    const model = findSupportedChatModel(modelId);
    if(!model) {
        throw new Error(`Unsupported model:${modelId}`);
    }

    return resolveSupportedChatModel(model);
}