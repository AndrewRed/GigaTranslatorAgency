package agency.agents;

import agency.Agent;
import chat.giga.client.GigaChatClient;
import chat.giga.model.ModelName;
import chat.giga.model.completion.*;
import lombok.RequiredArgsConstructor;

@RequiredArgsConstructor
public abstract class AbstractGigaChatAgent implements Agent {

    protected final GigaChatClient client;
    private final String systemPrompt;

    protected abstract String buildUserPrompt(String text);

    @Override
    public String process(String text) {
        CompletionRequest request = CompletionRequest.builder()
                .model(ModelName.GIGA_CHAT_MAX)
                .message(ChatMessage.builder().role(ChatMessageRole.SYSTEM).content(systemPrompt).build())
                .message(ChatMessage.builder().role(ChatMessageRole.USER).content(buildUserPrompt(text)).build())
                .build();
        CompletionResponse response = client.completions(request);
        return response.choices().get(0).message().content();
    }
}
