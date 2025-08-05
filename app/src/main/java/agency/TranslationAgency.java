package agency;

import lombok.RequiredArgsConstructor;

import java.util.List;

@RequiredArgsConstructor
public class TranslationAgency {
    private final List<Agent> agents;

    public String translate(String text) {
        String result = text;
        for (Agent agent : agents) {
            result = agent.process(result);
        }
        return result;
    }
}
