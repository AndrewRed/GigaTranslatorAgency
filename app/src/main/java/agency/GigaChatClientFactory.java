package agency;

import chat.giga.client.GigaChatClient;
import chat.giga.client.auth.AuthClient;
import chat.giga.client.auth.AuthClientBuilder.OAuthBuilder;
import chat.giga.model.Scope;

public final class GigaChatClientFactory {

    private GigaChatClientFactory() {
    }

    public static GigaChatClient createClient() {
        String key = System.getenv("GIGACHAT_AUTH_KEY");
        if (key == null || key.isEmpty()) {
            throw new IllegalStateException("GIGACHAT_AUTH_KEY environment variable is not set");
        }
        return GigaChatClient.builder()
                .verifySslCerts(false)
                .authClient(AuthClient.builder()
                        .withOAuth(OAuthBuilder.builder()
                                .scope(Scope.GIGACHAT_API_PERS)
                                .authKey(key)
                                .build())
                        .build())
                .build();
    }
}
