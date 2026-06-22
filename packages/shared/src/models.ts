export type ModelPricing = {
    inputUsdPerMillionTokens:number;
    outputUsdPerMillionTokens:number;
}

export type SupportedProvider = "openai";

type SupportedChatModelDefinition ={
    id: string;
    provider:SupportedProvider
    pricing:ModelPricing;
}

export const SUPPORTED_CHAT_MODELS =[ {
    id: "gpt-5.4-mini",
    provider:"openai",
    pricing: {
        inputUsdPerMillionTokens:0.75,
        outputUsdPerMillionTokens:4.5,

    },
    },
] as const satisfies readonly SupportedChatModelDefinition[]

export type SupportedChatModel =(typeof SUPPORTED_CHAT_MODELS)[number];

export type SupportedChatModelId=SupportedChatModel["id"];

export function findSupportedChatModel(modelId:string){
    return SUPPORTED_CHAT_MODELS.find((model)=> model.id===modelId);

}

export const DEFAULT_CHAT_MODEL_ID:SupportedChatModelId="gpt-5.4-mini";

