# Credits — audio samples

The code of LoFi Engine is MIT (see `LICENSE`). The **audio samples are not covered by that
licence** — they come from third parties, each with its own terms. This file traces what was
established, and how.

Two samples require crediting their author. That credit must appear wherever the engine's
output is published — including a 24/7 stream description. The block to paste is at the
bottom of this file.

## Established

| Sample(s) | Source | Author | Licence | Obligation |
|---|---|---|---|---|
| `PianoSamples/*.mp3` (48 files) | [Salamander Grand Piano V3](https://archive.org/details/SalamanderGrandPianoV3), via [@tonejs/piano](https://github.com/tambien/Piano) | Alexander Holm | CC BY 3.0 | **Credit required** |
| `tracks/Wind-Mark_DiAngelo-1940285615.mp3` | [SoundBible #1810](https://soundbible.com/1810-Wind.html) | Mark DiAngelo | CC BY 3.0 | **Credit required** |
| `effects/jungle.mp3` | [SoundBible #1818](https://soundbible.com/1818-Rainforest-Ambience.html) | GlorySunz | Public Domain | None |
| `effects/thunder.mp3` | [Sample Focus](https://samplefocus.com/license) | — | Sample Focus Standard | None. Commercial use allowed; redistributing the file *on its own* is not. Mixed into a stream is fine. |

**How the piano was established.** The file names alone prove nothing, so the reference samples
were downloaded from `@tonejs/piano` and compared: **8 out of 8 durations match, 5 of them to the
sample** (0.00 ms difference). The remaining 3 differ by under 1 ms, which is MP3 encoder padding.
Same source, re-encoded at a different bitrate.

The other three were read from the files' own ID3 tags (`artist=GlorySunz from SoundBible.com`,
`comment=Downloaded from Samplefocus.com`), and the licence confirmed on each source page.

## Not established

| Sample(s) | What is known | Risk |
|---|---|---|
| `tracks/*-NNNNN.mp3` (8 files) | The `name-123456.mp3` shape is Pixabay's naming. Their content licence requires no attribution and allows commercial use. **Identified by form, not proven** — the ID3 tags were stripped on re-encoding. | Low |
| `tracks/train-to-munich-germany.mp3` | No tag, no source-shaped name. | Low |
| `effects/fire.mp3`, `effects/rain.mp3` | No tag. Generic ambience. | Low |
| `DrumSamples/{hat,kick,snare}.mp3` | No tag. 0.1–12 s percussion hits. | Very low |

None of these carry an author name, so no credit can be written for them. They are generic
ambience and one-shot percussion — the kind of material that is rarely fingerprinted. If a
platform ever raises a claim on one, replace that file: the generated music does not depend on
any of them individually.

**The music itself is generated**, note by note, at playback time. No third-party composition is
broadcast — which is what usually gets music channels taken down. Only the ambience recordings
are third-party works.

## Credit block — paste into the stream description

```
Music generated live by LoFi Engine — https://github.com/Chrlstopher-c/lofi-engine

Piano samples: Salamander Grand Piano V3 by Alexander Holm (CC BY 3.0)
  https://creativecommons.org/licenses/by/3.0/
Wind: Mark DiAngelo, SoundBible (CC BY 3.0)
  https://creativecommons.org/licenses/by/3.0/
```
