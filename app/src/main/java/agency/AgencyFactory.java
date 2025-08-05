package agency;

import agency.agents.EditorAgent;
import agency.agents.ProofreaderAgent;
import agency.agents.TranslatorAgent;
import chat.giga.client.GigaChatClient;

import java.util.List;

public final class AgencyFactory {

    private AgencyFactory() {
    }

    public static TranslationAgency defaultAgency() {
        GigaChatClient client = GigaChatClientFactory.createClient();
        return new TranslationAgency(List.of(
                new TranslatorAgent(client),
                new EditorAgent(client),
                new ProofreaderAgent(client)
        ));
    }
}
