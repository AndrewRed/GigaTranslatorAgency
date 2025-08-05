package agency;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class TranslationAgencyTest {

    @Test
    void pipelineProcessesAgentsInOrder() {
        TranslationAgency agency = new TranslationAgency(List.of(
                text -> text + "A",
                text -> text + "B"
        ));
        assertEquals("startAB", agency.translate("start"));
    }
}
