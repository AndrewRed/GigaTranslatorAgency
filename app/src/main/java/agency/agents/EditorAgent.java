package agency.agents;

import chat.giga.client.GigaChatClient;

public class EditorAgent extends AbstractGigaChatAgent {

    private static final String SYSTEM_PROMPT = "You are a Russian literary editor. Improve style and readability while keeping the author's voice.";

    public EditorAgent(GigaChatClient client) {
        super(client, SYSTEM_PROMPT);
    }

    @Override
    protected String buildUserPrompt(String text) {
        return "Edit the following Russian text for style and readability, keeping the author's voice. Respond only with the edited text:\n\n" + text;
    }
}
