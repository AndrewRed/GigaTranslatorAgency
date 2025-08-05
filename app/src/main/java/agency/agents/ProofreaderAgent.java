package agency.agents;

import chat.giga.client.GigaChatClient;

public class ProofreaderAgent extends AbstractGigaChatAgent {

    private static final String SYSTEM_PROMPT = "You are a meticulous Russian proofreader. Correct grammar, spelling and punctuation while preserving style.";

    public ProofreaderAgent(GigaChatClient client) {
        super(client, SYSTEM_PROMPT);
    }

    @Override
    protected String buildUserPrompt(String text) {
        return text;
    }
}
