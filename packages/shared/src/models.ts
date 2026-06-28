export type ModelPricing = {
    inputUsdPerMillionTokens:number;
    outputUsdPerMillionTokens:number;
}

export type SupportedProvider = "openai" | "openrouter";

type SupportedChatModelDefinition ={
    id: string;
    provider:SupportedProvider
    pricing:ModelPricing;
}

export const SUPPORTED_CHAT_MODELS =[ {
    id: "openai/gpt-oss-120b:free",
    provider:"openai",
    pricing: {
        inputUsdPerMillionTokens:0.75,
        outputUsdPerMillionTokens:4.5,

    },
    },
    {
    id: "openai/gpt-oss-120b:free",
    provider:"openrouter",
    pricing: {
        inputUsdPerMillionTokens:0.75,
        outputUsdPerMillionTokens:4.5,

    },
    },
    {
        id: "anthropic/claude-sonnet-4-20250514",
        provider:"openrouter",
        pricing: {
            inputUsdPerMillionTokens:3.0,
            outputUsdPerMillionTokens:15.0,
        },
    },
    {
        id: "nvidia/nemotron-3-super-120b-a12b:free",
        provider:"openrouter",
        pricing: {
            inputUsdPerMillionTokens:2.5,
            outputUsdPerMillionTokens:10.0,
        },
    },
    {
        id: "google/gemini-2.0-flash-001",
        provider:"openrouter",
        pricing: {
            inputUsdPerMillionTokens:0.10,
            outputUsdPerMillionTokens:0.40,
        },
    },
] as const satisfies readonly SupportedChatModelDefinition[]

export type SupportedChatModel =(typeof SUPPORTED_CHAT_MODELS)[number];

export type SupportedChatModelId=SupportedChatModel["id"];

export function findSupportedChatModel(modelId:string){
    return SUPPORTED_CHAT_MODELS.find((model)=> model.id===modelId);

}

export const DEFAULT_CHAT_MODEL_ID:SupportedChatModelId="nvidia/nemotron-3-super-120b-a12b:free";

