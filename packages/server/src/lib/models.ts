import {openai, createOpenAI} from "@ai-sdk/openai"
import {openrouter} from "@openrouter/ai-sdk-provider"
import {
    findSupportedChatModel,
    type SupportedChatModel,
    type SupportedChatModelId,
    type SupportedProvider,
    
} from "@KL-CODE/shared"
import type { ProviderOptions} from "@ai-sdk/provider-utils"
import type { LanguageModel } from "ai";

type OpenAIModelId=Extract<SupportedChatModel,{provider:"openai"}>["id"];
type OpenRouterModelId=Extract<SupportedChatModel,{provider:"openrouter"}>["id"];
type OllamaModelId=Extract<SupportedChatModel,{provider:"ollama"}>["id"];

const ollamaProvider = createOpenAI({
    baseURL: "http://localhost:11434/v1",
    name: "ollama",
    apiKey: "ollama",
});

export type ResolvedModel ={
    model:LanguageModel;
    provider:SupportedProvider;
    modelId: SupportedChatModelId;
    providerOptions?:ProviderOptions
}

const OPENROUTER_PROVIDER_OPTIONS: Partial<Record<OpenRouterModelId, ProviderOptions>> = {
  "openai/gpt-oss-120b:free": {
    openrouter: {
      reasoning: {
        max_tokens: 10000,
      },
    },
  },

  "nvidia/nemotron-3-super-120b-a12b:free": {
    openrouter: {
      reasoning: {
        max_tokens: 10000,
      },
    },
  },

  "qwen/qwen3-coder:free": {
    openrouter: {
      reasoning: {
        max_tokens: 10000,
      },
    },
  },
};


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
        providerOptions:OPENROUTER_PROVIDER_OPTIONS[modelId]
    }
}

function resolveOllamaModel(modelId:OllamaModelId): ResolvedModel {
    const localModelId = modelId.replace("ollama/", "") as OllamaModelId
    return {
        model:ollamaProvider.chat(localModelId),
        provider:"ollama",
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
        case "ollama":
            return resolveOllamaModel(model.id)
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