import { createHash } from 'node:crypto';

// Editorial annotations, not content admission. Each entry was checked against
// the exact passage: companionship is sitting/staying together; recovery is a
// quiet pause or accepting rest; practice is actual training; competition is
// an actual game or spar. No tag is inferred from a reservoir family name.
// A changed passage loses its annotation until this table is reviewed again.
export const narrativeSceneHash = scene => createHash('sha256').update(JSON.stringify({
  cast: scene.cast, location: scene.location, area: scene.area, beats: scene.beats,
})).digest('hex');

const cache = new WeakMap();
const deeplyFrozen = value => !value || typeof value !== 'object'
  || Object.isFrozen(value) && Object.values(value).every(deeplyFrozen);
export function narrativeSceneTags(scene) {
  if (!scene || typeof scene !== 'object') return null;
  if (cache.has(scene)) return cache.get(scene);
  const review = NARRATIVE_SCENE_TAGS[scene.id];
  const result = review && review.contentHash === narrativeSceneHash(scene)
    && (!review.sourceHash || review.sourceHash === scene.reservoir?.sourceHash) ? review : null;
  // A shallow-frozen scene may still contain editable beats or cast members.
  // Only deeply immutable content can keep its review result between calls.
  if (deeplyFrozen(scene)) cache.set(scene, result);
  return result;
}

// Reviewed 2026-09-20. Values are generated from the inspected source once,
// committed here, and never regenerated during simulation or presentation.
export const NARRATIVE_SCENE_TAGS = Object.freeze(Object.fromEntries(Object.entries({
  "C2": {
    "contentHash": "4769798d1fcc6cf240c71e64fd05c9670ff344b411af7118eb862bc83dca11bc",
    "motifs": [
      "practice",
      "everyday_competition"
    ],
    "evidenceKinds": [],
    "subtlety": 0.6
  },
  "C3": {
    "contentHash": "172d31f6998decf105a64925863ca415b9464e2864fcb98bdf93045b44eda214",
    "motifs": [
      "practice"
    ],
    "evidenceKinds": [],
    "subtlety": 0.6
  },
  "C7": {
    "contentHash": "eef5824b8ffb64de7bebf8e056fc3fbbb0daf2b42f15361938dc70133a38ca52",
    "motifs": [
      "practice",
      "everyday_competition"
    ],
    "evidenceKinds": [],
    "subtlety": 0.6
  },
  "C9": {
    "contentHash": "a3288ba9fefd6bd2d7f47a436ff962e31437fef603b5705ccc39aabf6a531b30",
    "motifs": [
      "practice",
      "everyday_competition"
    ],
    "evidenceKinds": [],
    "subtlety": 0.6
  },
  "E6": {
    "contentHash": "1d98fd4bb0c1ba5bb5891346eb069c81d019b5c5a91487ceeb68edb63491ea6a",
    "motifs": [
      "shared_recovery"
    ],
    "evidenceKinds": [
      "pressure_residue"
    ],
    "subtlety": 0.7
  },
  "E7": {
    "contentHash": "1b87419ac9bf528386d1e105ba46da07f468aed8c21c9736950d5f95cc944788",
    "motifs": [],
    "evidenceKinds": [
      "fragile_obligation"
    ],
    "subtlety": 0.8
  },
  "E13": {
    "contentHash": "fb0b1c56b6c2df731a2f06755013832faf691d04e9157fe112c1d4b08948b645",
    "motifs": [
      "companionship"
    ],
    "evidenceKinds": [],
    "subtlety": 0.6
  },
  "F6": {
    "contentHash": "4a6fd4ace9cac9c0b1bd883e9390d77c33dac370e7fce8958207eeab10a9a127",
    "motifs": [
      "companionship",
      "everyday_competition"
    ],
    "evidenceKinds": [],
    "subtlety": 0.6
  },
  "I2": {
    "contentHash": "ed4374fd58df9b709d59878807b592fb1eacbb5f0ced7fddeb57c229e5dc3b74",
    "motifs": [
      "practice",
      "everyday_competition"
    ],
    "evidenceKinds": [],
    "subtlety": 0.6
  },
  "I10": {
    "contentHash": "48ccdfe9c1c5a49bf9a1b855daf5d7aeb3a234f63f0ab8a47f07d88dea4ccc60",
    "motifs": [
      "everyday_competition"
    ],
    "evidenceKinds": [],
    "subtlety": 0.6
  },
  "N1": {
    "contentHash": "688ae60c9e87921c0626e9f5669bb9cc4a3299b090cd5df74fbb13147f71a339",
    "motifs": [
      "shared_recovery",
      "companionship"
    ],
    "evidenceKinds": [
      "pressure_residue"
    ],
    "subtlety": 0.7
  },
  "N6": {
    "contentHash": "b5c4dc02e1636404f5d5c7f57d4d4c4c44bbfef1734992b7e2b8989313391fe3",
    "motifs": [
      "shared_recovery",
      "companionship"
    ],
    "evidenceKinds": [
      "unresolved_interruption"
    ],
    "subtlety": 0.7
  },
  "N7": {
    "contentHash": "7b8c932173bc0955815ed79e488dca4e3bb2c3e9e130858467d0b6b9cd9a5ade",
    "motifs": [
      "practice",
      "shared_recovery"
    ],
    "evidenceKinds": [],
    "subtlety": 0.6
  },
  "R:domestic.ashai_greah.quiet.04": {
    "contentHash": "151f2f49cba25cb72ab7ce1cdee8336967a3a5e0f95fc20efcb55edf1bbc241e",
    "sourceHash": "b0ad96d2558f0570381d39f42b24cff274a420d8cf6d5e01459433a078814b49",
    "motifs": [
      "shared_recovery",
      "companionship"
    ],
    "evidenceKinds": [
      "pressure_residue"
    ],
    "subtlety": 0.8
  },
  "R:domestic.ashai_greah.quiet.07": {
    "contentHash": "cba7f77614d123244989888f5b978c8a6616c06f747178ffb54c506e5b859f9e",
    "sourceHash": "63f69ad757ffe505e5b5f702849f5fac96112b25bfd49285095e2e493b66d3e8",
    "motifs": [
      "companionship"
    ],
    "evidenceKinds": [
      "pressure_residue"
    ],
    "subtlety": 0.6
  },
  "R:domestic.goaden_kai.quiet.03": {
    "contentHash": "adb21f01e5cd22b080648a6fd1cb7bb2e469ee2fa5d44967c5c9faa6c731960a",
    "sourceHash": "357e92df1466f7501463c78cdb8b1ce287510ea1c2eca61a87465d78c751dda2",
    "motifs": [
      "companionship",
      "shared_recovery"
    ],
    "evidenceKinds": [
      "pressure_residue"
    ],
    "subtlety": 0.7
  },
  "R:domestic.goaden_kai.quiet.05": {
    "contentHash": "68d0083a67078e305342c6f2126d8edb1d3c44960d8556f18b0f214b9b7489e9",
    "sourceHash": "053f4661474cdd413b547226ceb1830bad2a0f2102871cd557899740ec54d960",
    "motifs": [
      "companionship"
    ],
    "evidenceKinds": [],
    "subtlety": 0.6
  },
  "R:domestic.goaden_kai.quiet.10": {
    "contentHash": "4424713d5640a55d5e43955d34651c074a404c4142f6799afb31719864206812",
    "sourceHash": "78772997011bf2777b33fdc8bcfcbc5af6dc5eea5f6f09918094540de1dfa6ac",
    "motifs": [
      "companionship"
    ],
    "evidenceKinds": [],
    "subtlety": 0.6
  },
  "R:domestic.shared_meal.01": {
    "contentHash": "ce371f428098067beac29de6721e7a238968bf9a93e2c5f197f2d072f19f3872",
    "sourceHash": "f65b22dc5d3a69f02c826326322afcbbd745c28165a5d802585dd4343dcedcba",
    "motifs": [
      "companionship"
    ],
    "evidenceKinds": [],
    "subtlety": 0.6
  },
  "R:domestic.shared_meal.04": {
    "contentHash": "8ad903d8b979eea1192f4e40b72201194480bba06ad6efd52bff69d63172f036",
    "sourceHash": "620ad9b5c98a6834e876f8326ba91139a3e4479333f7045f63eb3b5d30278858",
    "motifs": [
      "companionship",
      "shared_recovery"
    ],
    "evidenceKinds": [
      "pressure_residue"
    ],
    "subtlety": 0.7
  },
  "R:domestic.shared_meal.05": {
    "contentHash": "fca96ef254be02bc4be1df83b67c61f6c59118b45d4b5d9ababc23d9d99d09db",
    "sourceHash": "a644b84e62acc438adc2562df59373684f511741d889f5e539437fc47cf93839",
    "motifs": [
      "shared_recovery"
    ],
    "evidenceKinds": [
      "pressure_residue",
      "fragile_obligation"
    ],
    "subtlety": 0.7
  },
  "R:domestic.shared_meal.08": {
    "contentHash": "c2a3fad39ce5dc75833198001de39c20a6df5567cbf276545bc388e012fc61c4",
    "sourceHash": "0d071292b952346cfdb8810595a036957bd4f46d3781827dea5c0462c9e5a02c",
    "motifs": [
      "shared_recovery",
      "companionship"
    ],
    "evidenceKinds": [
      "pressure_residue"
    ],
    "subtlety": 0.8
  },
  "R:domestic.cross_paths.06": {
    "contentHash": "dae7477f1f9d72b4b4972ff3e1a6b1cb39a675b81c9651c05f78a5721865a2f4",
    "sourceHash": "d5807fc8d75eefce02c913de6723110eb394504c8be61df5404eb3b0f058f1ad",
    "motifs": [
      "everyday_competition"
    ],
    "evidenceKinds": [],
    "subtlety": 0.6
  },
  "R:domestic.cross_paths.08": {
    "contentHash": "6784548aa57454768c67a7fe3c5abc135eb72c842ad0d36025af3bc804a1702e",
    "sourceHash": "7ff7b3dd285126c60dcbf8b13b42ce88a01b00f1913905635f9c5f443e21f130",
    "motifs": [
      "companionship"
    ],
    "evidenceKinds": [],
    "subtlety": 0.6
  },
  "R:domestic.cross_paths.10": {
    "contentHash": "dda9ae9c4b74674a280e8f2b134e4caadec63dd077e5f92d17c845d1c94ad5f6",
    "sourceHash": "7d52fb91a1c2b7f71c99e90fae0b810fa9aca6a45f9cf3e1113de951f66f7901",
    "motifs": [
      "companionship",
      "shared_recovery"
    ],
    "evidenceKinds": [
      "pressure_residue"
    ],
    "subtlety": 0.7
  },
  "R:domestic.practice_end.01": {
    "contentHash": "0c60ef26bed96b685d1c4abc3ab0b7fa2265b6792088fca71a9aec48e3b1897d",
    "sourceHash": "f74678ee285c0acd38567a01333cc78223370efa136cf600e6cc480234f0f348",
    "motifs": [
      "practice",
      "everyday_competition"
    ],
    "evidenceKinds": [],
    "subtlety": 0.6
  },
  "R:domestic.practice_end.02": {
    "contentHash": "a586b739fe3c385769255d38f55976af36bc094d4f3c1f7e6761084903c733bf",
    "sourceHash": "e188843f129fa05fe6ca6882cb6918324145f1eef6c106a43f258435f7bd5285",
    "motifs": [
      "practice",
      "shared_recovery"
    ],
    "evidenceKinds": [],
    "subtlety": 0.6
  },
  "R:domestic.practice_end.04": {
    "contentHash": "0579f22e5ac183c8ed5a86f6f2984bff0d7cdd988c4d7d7f4a8f3f4457f1e656",
    "sourceHash": "ab31d1ddb87b1e2a50c756a720c815e984f52e065f7bee6e14565d33eeea2939",
    "motifs": [
      "practice",
      "shared_recovery"
    ],
    "evidenceKinds": [],
    "subtlety": 0.6
  },
  "R:domestic.practice_end.05": {
    "contentHash": "7caac937fc3d4f2369d110cb0075a0f22ee443eac41489ed5bd29a071e160a5e",
    "sourceHash": "7c514f44de755af9938b526ffc9886ea8519924ac18e28c0c19356761fee4137",
    "motifs": [
      "practice",
      "companionship"
    ],
    "evidenceKinds": [],
    "subtlety": 0.6
  },
  "R:domestic.practice_end.06": {
    "contentHash": "fc3290649aa9522d67f2e75c3c7139c2663a03fee2821aea09af55a01d56c947",
    "sourceHash": "03b2885d74e7087bbd90054f98002987dc3e87377a2431fd00455b062b122821",
    "motifs": [
      "practice",
      "shared_recovery"
    ],
    "evidenceKinds": [],
    "subtlety": 0.6
  },
  "R:domestic.practice_end.09": {
    "contentHash": "0346d01e93e93f1e439480e3bdd7234cde7a610c14b3dc228e947da226c8f9c6",
    "sourceHash": "f5b34dc9e42865861f8b13062bca789451625ad6917a384989cfd93f875746c1",
    "motifs": [
      "practice",
      "companionship"
    ],
    "evidenceKinds": [],
    "subtlety": 0.6
  },
  "R:domestic.yukon_shared.01": {
    "contentHash": "b8add824253203bc4d0fa06eff3a8383c537a94c6ff0487673e93e50887234c3",
    "sourceHash": "0453a7b2e94444d806e736f05859a0a132eb2f47c1137a687575267999fd2182",
    "motifs": [
      "everyday_competition",
      "companionship"
    ],
    "evidenceKinds": [],
    "subtlety": 0.6
  },
  "R:domestic.yukon_shared.02": {
    "contentHash": "d7c52d3d8150b6e7546f5c74bff16f690148351ebba33a5877fed0a6c7c6f15d",
    "sourceHash": "25cb41cc3c03c7a36287fcc85031c028c785bced349974dbb3cca6dfef600cff",
    "motifs": [
      "everyday_competition"
    ],
    "evidenceKinds": [],
    "subtlety": 0.6
  },
  "R:domestic.yukon_shared.03": {
    "contentHash": "6025b6d759a09d1ab36e3c2929212c8a7877e9e3b384a01f9c1977db5621aa80",
    "sourceHash": "22316d022da6f6a0b1a0417ff945b8448ca7e1c46c251ac53f1884e9dcd28459",
    "motifs": [
      "everyday_competition",
      "companionship"
    ],
    "evidenceKinds": [],
    "subtlety": 0.6
  },
  "R:domestic.yukon_shared.04": {
    "contentHash": "15e93a7572d70f10a4f474a4640a8bef6e8ea3a7416e7374daff5e59c27d815a",
    "sourceHash": "53fa734e3a85c7464b29d732a8a7fb73a1c0567b0b2e52463608d8a7e23bf46e",
    "motifs": [
      "everyday_competition"
    ],
    "evidenceKinds": [],
    "subtlety": 0.6
  },
  "R:domestic.yukon_shared.05": {
    "contentHash": "79853bd85907fe61d586c04aaf66be06a66ca647b1215f44d8cdf1fe77552f41",
    "sourceHash": "d8b3ce3610b5c7331a41a5a34fa6effc7bc77a5df9b0cdd0f8802047c044ebf0",
    "motifs": [
      "everyday_competition"
    ],
    "evidenceKinds": [],
    "subtlety": 0.6
  }
}).map(([id, entry]) => [id, Object.freeze({...entry, motifs: Object.freeze(entry.motifs), evidenceKinds: Object.freeze(entry.evidenceKinds)})])));
