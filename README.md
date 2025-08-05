# GigaTranslatorAgency

GigaTranslatorAgency is a multi-agent Java application that translates English fiction into Russian using [GigaChat](https://developers.sber.ru/docs/ru/gigachat/api/reference/rest/gigachat-api). The system emulates a professional translation agency with dedicated agents for translation, literary editing and proofreading.

## Features

- **TranslatorAgent** – converts English text to Russian with attention to literary tone.
- **EditorAgent** – polishes the translation to read like work of a Russian author.
- **ProofreaderAgent** – fixes grammar, punctuation and typographic issues.
- **Swing GUI** – user friendly interface to enter text and view the result.

## Usage

1. Obtain a GigaChat API authorization key and export it as an environment variable:

```bash
export GIGACHAT_AUTH_KEY=your_key_here
```

2. Run the application:

```bash
./gradlew :app:run
```

A window will open where you can paste English text and receive the Russian translation.

## Development

The project uses Java 21, Gradle, Lombok and the `chat.giga:gigachat-java` library. Run tests with:

```bash
./gradlew test
```
