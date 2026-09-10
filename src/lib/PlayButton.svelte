<script lang="ts">
  import {
      IconLoader,
      IconPlayerPauseFilled,
      IconPlayerPlayFilled,
      IconRefresh,
  } from "@tabler/icons-svelte";
  import { onDestroy, onMount } from "svelte";
// @ts-ignore
  import * as Tone from "tone";
  import Visualizer from "../lib/components/Visualizer/index.svelte";
  import ChordProgression from "../lib/engine/Chords/ChordProgression";
  import intervalWeights from "../lib/engine/Chords/IntervalWeights";
  import Keys from "../lib/engine/Chords/Keys";
  import { fiveToFive } from "../lib/engine/Chords/MajorScale";
  import Hat from "../lib/engine/Drums/Hat";
  import Kick from "../lib/engine/Drums/Kick";
  import Noise from "../lib/engine/Drums/Noise";
  import Snare from "../lib/engine/Drums/Snare";
  import Piano from "../lib/engine/Piano/Piano";
  import { alea, aleaEntier, graine, graineEnTexte, semer, graineDepuisTexte } from "../lib/engine/Alea";

  // Une graine passée dans l'URL rejoue la même composition : ?graine=1a2b3c4d.
  // Sans elle, une graine est tirée au hasard et annoncée — c'est elle qu'on note pour
  // retrouver un passage réussi.
  const graineDemandee = graineDepuisTexte(
    new URLSearchParams(window.location.search).get("graine") ?? "",
  );
  if (graineDemandee !== null) semer(graineDemandee);
  console.info(`[moteur] graine ${graineEnTexte(graine())}`);

  const STORAGE_KEY = "Volumes";
  const DEFFAULT_VOLUMES = {
    rain: 1,
    thunder: 1,
    campfire: 1,
    jungle: 1,
    main_track: 1,
  };
  // Load previous vols or defualt
  let volumes =
    JSON.parse(localStorage.getItem(STORAGE_KEY)) || DEFFAULT_VOLUMES;
  // Convert linear volume (0 to 1) to dB
  const linearToDb = (value) =>
    value === 0 ? -Infinity : 20 * Math.log10(value);

  // Setup audio chain
  const cmp = new Tone.Compressor({
    threshold: -6,
    ratio: 3,
    attack: 0.5,
    release: 0.1,
  });
  const lpf = new Tone.Filter(2000, "lowpass");
  const vol = new Tone.Volume(linearToDb(volumes.main_track));
  Tone.Master.chain(cmp, lpf, vol);
  Tone.Transport.bpm.value = 156;
  Tone.Transport.swing = 1;

  // State variables
  let key = "C";
  let progression = [];
  let accordSonnant = null;
  let scale = [];
  let progress = 0;
  let scalePos = 0;

  let pianoLoaded = false;
  let kickLoaded = false;
  let snareLoaded = false;
  let hatLoaded = false;

  let contextStarted = false;
  let genChordsOnce = false;

  let kickOff = false;
  let snareOff = false;
  let hatOff = false;
  let melodyDensity = 0.33;
  let melodyOff = false;

  let isPlaying = false;
  let autoDJMode = "MUSIC";

  // Initialize instruments
  const pn = new Piano(() => (pianoLoaded = true)).sampler;
  const kick = new Kick(() => (kickLoaded = true)).sampler;
  const snare = new Snare(() => (snareLoaded = true)).sampler;
  const hat = new Hat(() => (hatLoaded = true)).sampler;
  const noise = Noise;

  // Sequences
  let chords, melody, kickLoop, snareLoop, hatLoop;

  onMount(() => {
    // Setup sequences
    chords = new Tone.Sequence(
      (time, note) => {
        playChord();
      },
      [""],
      "1n",
    );

    melody = new Tone.Sequence(
      (time, note) => {
        playMelody();
      },
      [""],
      "8n",
    );

    kickLoop = new Tone.Sequence(
      (time, note) => {
        if (!kickOff) {
          if (note === "C4" && alea() < 0.9) {
            // @ts-ignore
            kick.triggerAttack(note);
          } else if (note === "." && alea() < 0.1) {
            // @ts-ignore
            kick.triggerAttack("C4");
          }
        }
      },
      ["C4", "", "", "", "", "", "", "C4", "C4", "", ".", "", "", "", "", ""],
      "8n",
    );

    snareLoop = new Tone.Sequence(
      (time, note) => {
        if (!snareOff) {
          if (note !== "" && alea() < 0.8) {
            // @ts-ignore
            snare.triggerAttack(note);
          }
        }
      },
      ["", "C4"],
      "2n",
    );

    hatLoop = new Tone.Sequence(
      (time, note) => {
        if (!hatOff) {
          // @ts-ignore
          if (note !== "" && alea() < 0.8) {
            // @ts-ignore
            hat.triggerAttack(note);
          }
        }
      },
      ["C4", "C4", "C4", "C4", "C4", "C4", "C4", "C4"],
      "4n",
    );

    chords.humanize = true;
    melody.humanize = true;
    kickLoop.humanize = true;
    snareLoop.humanize = true;
    hatLoop.humanize = true;

    // Listen for spacebar press
    const handleKeydown = (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        toggle();
      }
    };

    const handleCustomToggle = () => {
      handleButtonAction();
    };

    const handleAutoDJModeChange = (e) => {
      autoDJMode = e.detail.mode;
    };

    window.addEventListener("keydown", handleKeydown);
    window.addEventListener("lofi-toggle-play", handleCustomToggle);
    window.addEventListener("auto-dj-mode-changed", handleAutoDJModeChange);

    // Initialize mode
    autoDJMode = localStorage.getItem("AutoDJMode") || "MUSIC";

    return () => {
      window.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("lofi-toggle-play", handleCustomToggle);
      window.removeEventListener("auto-dj-mode-changed", handleAutoDJModeChange);
    };
  });

  onDestroy(() => {
    if (Tone.Transport.state === "started") {
      noise.stop();
      Tone.Transport.stop();
    }
  });

  let barCount = 0;
  let sectionBarLength = 32; // change section every 32 bars
  let isTransitioning = false;

  function nextChord() {
    const nextProgress = progress === progression.length - 1 ? 0 : progress + 1;
    const nextKickOff = alea() < 0.15;
    const nextSnareOff = alea() < 0.2;
    const nextHatOff = alea() < 0.25;
    const nextMelodyDensity = alea() * 0.3 + 0.2;
    const nextMelodyOff = alea() < 0.25;

    if (progress === 4) {
      progress = nextProgress;
      kickOff = nextKickOff;
      snareOff = nextSnareOff;
      hatOff = nextHatOff;
    } else if (progress === 0) {
      progress = nextProgress;
      kickOff = nextKickOff;
      snareOff = nextSnareOff;
      hatOff = nextHatOff;
      melodyDensity = nextMelodyDensity;
      melodyOff = nextMelodyOff;
    } else {
      progress = nextProgress;
    }
    barCount++;
    if(barCount >= sectionBarLength) {
      barCount = 0;
      autoDJTransition();
      // New next transition length
      const barLengthOptions = [16, 20, 24, 28, 32, 48];
      sectionBarLength = barLengthOptions[aleaEntier(barLengthOptions.length)];
    }
  }

  function autoDJTransition() {
    if(isTransitioning) return; // Prevent overlaps
    if(autoDJMode === "MANUAL") return;

    isTransitioning = true;

    // Change keys/chords
    generateProgression()
    
    // Original Instrument Logic (Applied in ALL active modes: MUSIC, ATMOSPHERE, WORLD)
    // This was the "current main lofi track generation"
    melodyDensity = 0.2 + alea() * 0.5;
    kickOff = alea() < 0.13;
    snareOff = alea() < 0.17;
    hatOff = alea() < 0.22;
    melodyOff = alea() < 0.25;

    // Smart Effects: Toggle environmental effects randomly
    // Applied in ATMOSPHERE and WORLD
    if (autoDJMode === "ATMOSPHERE" || autoDJMode === "WORLD") {
      const effects = ["rain", "thunder", "jungle", "campfire"];
      // 30% chance to toggle an effect
      if (alea() < 0.3) {
        const effect = effects[aleaEntier(effects.length)];
        window.dispatchEvent(new CustomEvent(`lofi-toggle-${effect}`));
      }
    }

    // Smart Tracks: Toggle tracks randomly
    // Applied ONLY in WORLD
    if (autoDJMode === "WORLD") {
      // 20% chance to toggle a track
      if (alea() < 0.2) {
        const trackId = Math.floor(alea() * 9) + 1; // 1-9
        window.dispatchEvent(new CustomEvent("lofi-toggle-track", { detail: { id: trackId } }));
      }
    }

    // Crossfade FX (Always apply for smoother transitions if not OFF)
    lpf.frequency.linearRampTo(300, 2) // 2s Muffle
    setTimeout(() => {
      lpf.frequency.linearRampTo(1200, 2) // Open back up
      setTimeout(() => {
        isTransitioning = false;
      }, 2000);
    }, 2000);
  }

  function playChord() {
    const chord = progression[progress];
    const root = Tone.Frequency(key + "3").transpose(chord.semitoneDist);
    const size = 4;
    const voicing = chord.generateVoicing(size);
    const notes = Tone.Frequency(root)
      .harmonize(voicing)
      .map((f) => Tone.Frequency(f).toNote());
    // @ts-ignore
    pn.triggerAttackRelease(notes, "1n");
    accordSonnant = chord;
    nextChord();
  }

  // Combien la mélodie préfère une note de l'accord en cours à une note simplement dans la
  // gamme. 1 = comme avant, indifférente. Au-delà de 4 elle arpège et cesse de chanter.
  const PENCHANT_ACCORD = 3;

  /** Les hauteurs de l'accord qui sonne, ramenées à l'octave, relatives à la tonique. */
  function classesDeLAccord() {
    if (!accordSonnant) return null;
    const classes = new Set();
    for (const intervalle of accordSonnant.intervals) {
      classes.add((accordSonnant.semitoneDist + intervalle) % 12);
    }
    return classes;
  }

  /** Le degré de la gamme atteint par ce pas est-il dans l'accord ? */
  function penchant(classes, position) {
    if (!classes) return 1;
    const demiTons = fiveToFive[position];
    if (demiTons === undefined) return 1;
    return classes.has(((demiTons % 12) + 12) % 12) ? PENCHANT_ACCORD : 1;
  }

  function playMelody() {
    if (melodyOff || !(alea() < melodyDensity)) {
      return;
    }

    const descendRange = Math.min(scalePos, 7) + 1;
    const ascendRange = Math.min(scale.length - scalePos, 7);

    let descend = descendRange > 1;
    let ascend = ascendRange > 1;

    if (descend && ascend) {
      if (alea() > 0.5) {
        ascend = !descend;
      } else {
        descend = !ascend;
      }
    }

    let weights = descend
      ? intervalWeights.slice(0, descendRange)
      : intervalWeights.slice(0, ascendRange);

    // Les petits intervalles restaient les plus probables, mais sans aucun égard pour
    // l'harmonie : la mélodie se promenait dans la gamme, pas sur l'accord. Elle pouvait donc
    // tomber sur une note qui frotte — par hasard, jamais par choix. Le poids de chaque pas
    // est maintenant relevé quand il atterrit sur une note de l'accord qui sonne.
    const classes = classesDeLAccord();
    weights = weights.map((w, pas) => w * penchant(classes, scalePos + (descend ? -pas : pas)));

    const sum = weights.reduce((prev, curr) => prev + curr, 0);
    weights = weights.map((w) => w / sum);
    for (let i = 1; i < weights.length; i++) {
      weights[i] += weights[i - 1];
    }

    const randomWeight = alea();
    let scaleDist = 0;
    let found = false;
    while (!found) {
      if (randomWeight <= weights[scaleDist]) {
        found = true;
      } else {
        scaleDist++;
      }
    }

    const scalePosChange = descend ? -scaleDist : scaleDist;
    const newScalePos = scalePos + scalePosChange;

    scalePos = newScalePos;
    // @ts-ignore
    pn.triggerAttackRelease(scale[newScalePos], "2n");
  }

  // Une tonalité tirée au hasard parmi douze, c'était une chance sur six de sauter d'un
  // triton — la rupture s'entend. Les tonalités voisines sur le cycle des quintes partagent
  // presque toutes leurs notes : la modulation devient un glissement, pas une cassure.
  const POIDS_DISTANCE = [0.04, 0.3, 0.24, 0.16, 0.12, 0.09, 0.05];

  /** Position d'une tonalité sur le cycle des quintes : monter d'une quinte = sept demi-tons. */
  function placeSurLeCycle(indice) {
    return (indice * 7) % 12;
  }

  function tonaliteVoisine(actuelle) {
    const depart = placeSurLeCycle(Math.max(0, Keys.indexOf(actuelle)));
    const poids = Keys.map((_, indice) => {
      const ecart = Math.abs(placeSurLeCycle(indice) - depart);
      return POIDS_DISTANCE[Math.min(ecart, 12 - ecart)];
    });
    const total = poids.reduce((somme, p) => somme + p, 0);
    let tirage = alea() * total;
    for (let indice = 0; indice < Keys.length; indice++) {
      tirage -= poids[indice];
      if (tirage <= 0) return Keys[indice];
    }
    return Keys[Keys.length - 1];
  }

  function generateProgression() {
    const _scale = fiveToFive;
    const newKey = tonaliteVoisine(key);
    const newScale = Tone.Frequency(newKey + "5")
      .harmonize(_scale)
      .map((f) => Tone.Frequency(f).toNote());
    const newProgression = ChordProgression.generate(8);
    const newScalePos = aleaEntier(_scale.length);

    key = newKey;
    progress = 0;
    progression = newProgression;
    scale = newScale;
    genChordsOnce = true;
    scalePos = newScalePos;
  }

  function toggle() {
    progress = 0;
    if (Tone.Transport.state === "started") {
      noise.stop();
      Tone.Transport.stop();
      isPlaying = false;
    } else {
      Tone.start();
      Tone.Transport.start();
      noise.start(0);
      chords.start(0);
      melody.start(0);
      kickLoop.start(0);
      snareLoop.start(0);
      hatLoop.start(0);
      isPlaying = true;
    }
    window.dispatchEvent(new CustomEvent("lofi-play-state-changed", { detail: { isPlaying } }));
  }

  function startAudioContext() {
    Tone.start();
    contextStarted = true;
  }

  $: allSamplesLoaded = pianoLoaded && kickLoaded && snareLoaded && hatLoaded;
  $: activeProgressionIndex = (progress + 7) % 8;
  // Update volume
  onMount(() => {
    setInterval(() => {
      let updatedVol =
        JSON.parse(localStorage.getItem(STORAGE_KEY)) || DEFFAULT_VOLUMES;
      vol.volume.value = linearToDb(updatedVol.main_track);
    }, 100);
  });
  // automically start audio context after samples are loaded
  $: if (allSamplesLoaded && !contextStarted) {
    startAudioContext();
    generateProgression();
  }

  // ?autoplay=1 — démarre la lecture sans clic, pour la capture du corpus de stream.
  // Le navigateur doit tourner avec la politique de lecture automatique désactivée.
  const autoplayDemande = new URLSearchParams(location.search).has("autoplay");
  let autoplayFait = false;
  $: if (autoplayDemande && !autoplayFait && allSamplesLoaded && contextStarted && genChordsOnce) {
    autoplayFait = true;
    toggle();
  }

  function handleButtonAction() {
    if (!allSamplesLoaded) {
      // Do nothing, button is disabled
      return;
    } else if (!contextStarted) {
      // Initialize audio context
      startAudioContext();
    } else if (!genChordsOnce) {
      // Chords not generated yet, can't play
      return;
    } else {
      // Normal play/pause functionality
      toggle();
    }
  }
</script>

<div>
  <div class="controls">
    <button
      class="play-button"
      on:click={handleButtonAction}
      disabled={!allSamplesLoaded}
    >
      {#if !allSamplesLoaded}
        <IconLoader size={30} class="spinning" />
      {:else if !contextStarted}
        <span class="context-text">Initialize Audio</span>
      {:else if !genChordsOnce}
        <IconPlayerPlayFilled size={30} class="disabled" />
      {:else if isPlaying}
        <IconPlayerPauseFilled size={30} />
      {:else}
        <IconPlayerPlayFilled size={30} />
      {/if}
    </button>
    <button class="generateBtn glass" on:click={generateProgression}>
      <IconRefresh size={16} />
    </button>
  </div>

  {#if allSamplesLoaded && contextStarted}
    {#if genChordsOnce}
      <ol class="progressionList">
        <li class="key" id="glass">{key}</li>
        {#each progression as chord, idx}
          <li id="glass" class={idx === activeProgressionIndex ? "live" : ""}>
            {chord.degree}
          </li>
        {/each}
      </ol>
    {/if}
  {/if}
  {#if Tone.Transport.state === "started"}
    <div class="visualizer-container">
      <Visualizer audio={Tone.Master} />
    </div>
  {/if}
</div>

<style>
  .controls {
    position: fixed;
    bottom: 70px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column-reverse;
    justify-content: center;
    align-items: center;
    gap: 5px;
  }

  .play-button {
    width: 70px;
    height: 70px;
    border-radius: 50%;
    background-color: white;
    color: black;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10;
    border: none;
    cursor: pointer;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }

  .play-button:hover {
    box-shadow: 0 0 10px 0 rgba(0, 0, 0, 0.5);
  }

  .generateBtn {
    color: white;
    border: none;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    display: flex;
    justify-content: center;
    align-items: center;
    margin-top: 10px;
    outline: none;
  }

  .progressionList {
    position: fixed;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 10px;
    list-style: none;
    padding: 0;
    justify-content: center;
    flex-wrap: wrap;
    gap: 20px;
    z-index: 1;
  }

  .progressionList li {
    padding: 5px 10px;
    border-radius: 4px;
    color: white;
    border: 2px solid transparent;
  }

  .progressionList li.live {
    border-color:#ffffff66;
  }

  .visualizer-container {
    position: absolute;
    left: 30px;
    bottom: 30px;
    height: 180px;
    overflow: hidden;
    margin-top: 10px;
  }

  @media only screen and (max-width: 600px) {
    .play-button {
      margin-bottom: 40px;
    }
    .progressionList {
      bottom: 0;
      left: 0;
      width: 100vw;
      transform: scale(0.8);
    }
    .visualizer-container {
      display: none;
    }
  }
</style>
