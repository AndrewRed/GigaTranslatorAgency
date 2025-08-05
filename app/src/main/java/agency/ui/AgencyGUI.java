package agency.ui;

import agency.AgencyFactory;
import agency.TranslationAgency;

import javax.swing.*;
import java.awt.*;

public class AgencyGUI {

    private final TranslationAgency agency = AgencyFactory.defaultAgency();

    private void createAndShow() {
        JFrame frame = new JFrame("Giga Translator Agency");
        frame.setDefaultCloseOperation(WindowConstants.EXIT_ON_CLOSE);

        JTextArea input = new JTextArea(10, 40);
        input.setLineWrap(true);
        JTextArea output = new JTextArea(10, 40);
        output.setEditable(false);
        output.setLineWrap(true);

        JButton translate = new JButton("Translate");

        translate.addActionListener(e -> {
            translate.setEnabled(false);
            output.setText("Translating...");
            String text = input.getText();
            new Thread(() -> {
                try {
                    String result = agency.translate(text);
                    SwingUtilities.invokeLater(() -> output.setText(result));
                } catch (Exception ex) {
                    SwingUtilities.invokeLater(() -> output.setText("Error: " + ex.getMessage()));
                } finally {
                    SwingUtilities.invokeLater(() -> translate.setEnabled(true));
                }
            }).start();
        });

        JPanel panel = new JPanel();
        panel.setLayout(new BorderLayout(10, 10));
        JSplitPane split = new JSplitPane(JSplitPane.VERTICAL_SPLIT, new JScrollPane(input), new JScrollPane(output));
        split.setResizeWeight(0.5);
        panel.add(split, BorderLayout.CENTER);
        panel.add(translate, BorderLayout.SOUTH);

        frame.getContentPane().add(panel);
        frame.pack();
        frame.setLocationRelativeTo(null);
        frame.setVisible(true);
    }

    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> new AgencyGUI().createAndShow());
    }
}
