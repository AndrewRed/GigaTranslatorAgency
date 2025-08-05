package agency.agents;

import chat.giga.client.GigaChatClient;

public class TranslatorAgent extends AbstractGigaChatAgent {

    private static final String SYSTEM_PROMPT = "You are a professional literary translator. Translate English fiction into Russian preserving nuance and tone.";

    public TranslatorAgent(GigaChatClient client) {
        super(client, SYSTEM_PROMPT);
    }

    @Override
    protected String buildUserPrompt(String text) {
        return "Translate the following English text into Russian and respond only with the translation:\n\n" + text;
    }
}
