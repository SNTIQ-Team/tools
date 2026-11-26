import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyLawIndexAct, CURATED_LAW_INDEX_ACT_IDS, groupLawIndexActs, LAW_INDEX_GROUPS,
} from './lawIndexGroups';
import { kerfResources } from './i18n';

const act = (id: string, jurabk = id) => ({ id, jurabk });

// Independent corpus fixture: GII 2026-09-21 and Bayern-Recht 2026-09-17.
// Public IDs use the official jurabk, which can differ from the source slug.
const FEDERAL_CORPUS_IDS = `
fed_a_g fed_advermig_1976 fed_adwirkg fed_aentg_2009 fed_agg fed_aknv
fed_aktg fed_algiiv_2008 fed_amg_1976 fed_ao_1977 fed_arbgg fed_arbschg
fed_arbzg fed_asig fed_asylblg fed_asylvfg_1992 fed_asylzbv_2026
fed_aufenthg_2004 fed_aufenthv fed_aug_2011 fed_avbfernw_rmev fed_avbwasserv
fed_azrg fed_azrg_dv fed_b_o fed_baf_g fed_baunvo fed_bbaug fed_bbig_2005
fed_bdsg_2018 fed_beeg fed_beg fed_beitrvv fed_berathig fed_beratungsg
fed_beschv_2013 fed_betravg fed_betrvg fed_bewg fed_bgb fed_bgbeg fed_bgg
fed_bimschg fed_bitv_2_0 fed_bkgg_1996 fed_bkv fed_bmg fed_bnatschg_2009
fed_bqfg fed_bshg_76dv fed_bshg_88abs2dv_1988 fed_btmg_1981 fed_btog
fed_burlg fed_bverfgg fed_bvfg fed_bzrg fed_dbv fed_ddg fed_de_v fed_deuf_v
fed_eeg_2014 fed_einbtestv fed_entgfg fed_entgtranspg fed_enwg_2005
fed_erbstg_1974 fed_estg fed_famfg fed_famgkg fed_fernusg fed_fev_2010
fed_fgo fed_fpfzg fed_freiz_gg_eu_2004 fed_fvg_1971 fed_fzv_2023 fed_gastg
fed_geg fed_geschgehg fed_gewo fed_gewschg fed_gewstg fed_gg fed_gkg_2004
fed_gmbhg fed_grsidav fed_grstg_1973 fed_gvg fed_gvgeg fed_hauslg
fed_heizkostenv fed_hgb fed_hinschg fed_hwo fed_idnrg fed_ifg fed_ifsg
fed_ihkg fed_inso fed_intv fed_invstg_2018 fed_jarbschg fed_jgg fed_jveg
fed_kcang fed_kkg fed_kredwg fed_krwg fed_kschg fed_kstg_1977 fed_lpartg
fed_milog fed_mpdg fed_muschg_2018 fed_nachwg fed_nam_ndg fed_nav fed_ndav
fed_owig_1968 fed_ozg fed_pa_g_1986 fed_pauswg fed_pflbg fed_pflegezg
fed_pflvg fed_prodhaftg fed_prostschg fed_pstg fed_pstv fed_rbeg_2021
fed_rdg fed_rvg fed_rvo fed_sbgg fed_schwarzarbg_2004 fed_schwbawv fed_schwbwo
fed_sgb_1 fed_sgb_10 fed_sgb_11 fed_sgb_12 fed_sgb_14 fed_sgb_2 fed_sgb_3
fed_sgb_4 fed_sgb_5 fed_sgb_6 fed_sgb_7 fed_sgb_8 fed_sgb_9_2018 fed_sgg
fed_solzg_1995 fed_sozhidav_2019 fed_sozsichabkg_ukr fed_rustag fed_stgb
fed_stgbeg fed_stpo fed_stpoeg fed_stvg fed_stvo_2013 fed_stvzo_2012
fed_svev fed_tkg_2021 fed_tvg fed_tzbfg fed_uhvorschg fed_uklag
fed_ukraineaufenth_v fed_ukraineaufenthfgv fed_umwg_1995 fed_ustdv_1980
fed_ustg_1980 fed_uwg_2004 fed_vbvg_2023 fed_versausglg fed_versmedv
fed_viszg fed_vsbg fed_vvg_2008 fed_vwdg fed_vwdg_dv fed_vwgo fed_vwvfg
fed_vwvg fed_vwzg_2005 fed_waffg_2002 fed_wbvg fed_whg_2009 fed_wobindg
fed_woeigg fed_wofg fed_woflv fed_wogg fed_wogv fed_wovermrg fed_zag_2018
fed_zpo fed_zvg
`.trim().split(/\s+/u);

const BAVARIAN_CORPUS_IDS = [
  'by_agsg', 'by_agvwgo', 'by_aufng', 'by_bayeug', 'by_bayintg', 'by_pag',
  'by_bayverf', 'by_bayvwvfg', 'by_dvasyl', 'by_lstvg', 'by_vwzvg', 'by_zustvauslr',
];

test('all 200 federal and 12 Bavarian source corpus ids are explicitly covered once', () => {
  assert.equal(FEDERAL_CORPUS_IDS.length, 200);
  const corpus = [...FEDERAL_CORPUS_IDS, ...BAVARIAN_CORPUS_IDS];
  assert.equal(new Set(corpus).size, 212);
  assert.deepEqual(new Set(CURATED_LAW_INDEX_ACT_IDS), new Set(corpus));
  const grouped = groupLawIndexActs(corpus.map((id) => act(id)));
  const flattened = grouped.flatMap((group) =>
    group.subgroups.flatMap((subgroup) => subgroup.acts.map(({ id }) => id)));
  assert.equal(flattened.length, 212);
  assert.deepEqual(new Set(flattened), new Set(corpus));
  assert.equal(grouped.some(({ id }) => id === 'other'), false);
});

test('new corpus topics use reviewed stable IDs across the expanded domains', () => {
  const expected = [
    ['fed_asylzbv_2026', 'migration', 'migrationAsylum'],
    ['fed_deuf_v', 'migration', 'migrationResidence'],
    ['fed_algiiv_2008', 'social', 'socialIncome'],
    ['fed_de_v', 'social', 'socialGeneral'],
    ['fed_tvg', 'labour', 'labourCollective'],
    ['fed_arbschg', 'labour', 'labourProtection'],
    ['fed_famfg', 'justice', 'justiceFamily'],
    ['fed_rvg', 'justice', 'justiceServices'],
    ['fed_fgo', 'justice', 'justicePublicCourts'],
    ['fed_pstg', 'government', 'governmentRecords'],
    ['fed_bbig_2005', 'education', 'educationVocational'],
    ['fed_ao_1977', 'tax', 'taxProcedure'],
    ['fed_ustg_1980', 'tax', 'taxBusiness'],
    ['fed_grstg_1973', 'tax', 'taxProperty'],
    ['fed_hgb', 'commerce', 'commerceBusiness'],
    ['fed_vvg_2008', 'commerce', 'commerceFinance'],
    ['fed_uwg_2004', 'commerce', 'commerceMarkets'],
    ['fed_bbaug', 'housing', 'housingPlanning'],
    ['fed_woeigg', 'housing', 'housingResidential'],
    ['fed_bimschg', 'environment', 'environmentProtection'],
    ['fed_eeg_2014', 'environment', 'environmentEnergy'],
    ['fed_whg_2009', 'environment', 'environmentResources'],
    ['fed_stvo_2013', 'transport', 'transportRoad'],
    ['fed_fzv_2023', 'transport', 'transportVehicles'],
    ['fed_ifsg', 'health', 'healthPublic'],
    ['fed_amg_1976', 'health', 'healthProducts'],
    ['fed_b_o', 'health', 'healthProfessions'],
  ];
  for (const [id, groupId, subgroupId] of expected) {
    assert.deepEqual(classifyLawIndexAct(act(id)), { groupId, subgroupId }, id);
  }
});

test('every visible group and subgroup has a label in all four languages', () => {
  for (const [language, resource] of Object.entries(kerfResources)) {
    const labels = resource.kerf as Record<string, string>;
    for (const group of LAW_INDEX_GROUPS) {
      for (const key of [`lawTopic.group.${group.id}`,
        ...group.subgroups.map((id) => `lawTopic.subgroup.${id}`)]) {
        assert.equal(typeof labels[key], 'string', `${language}: ${key}`);
        assert.ok(labels[key].trim(), `${language}: ${key}`);
      }
    }
  }
});

test('representative acts land in explicit topic facets', () => {
  assert.deepEqual(classifyLawIndexAct(act('fed_ukraineaufenth_v')), {
    groupId: 'migration', subgroupId: 'migrationResidence',
  });
  assert.deepEqual(classifyLawIndexAct(act('fed_sgb_2')), {
    groupId: 'social', subgroupId: 'socialIncome',
  });
  assert.deepEqual(classifyLawIndexAct(act('fed_gg')), {
    groupId: 'government', subgroupId: 'governmentConstitution',
  });
  assert.deepEqual(classifyLawIndexAct(act('by_bayeug')), {
    groupId: 'education', subgroupId: 'educationSchool',
  });
});

test('unknown titles are honestly left in Other instead of guessed', () => {
  assert.deepEqual(classifyLawIndexAct({ id: 'future_asylum_sounding_act' }), {
    groupId: 'other', subgroupId: 'otherUnclassified',
  });
  const grouped = groupLawIndexActs([act('future_asylum_sounding_act', 'AsylWhatever')]);
  assert.equal(grouped[0].id, 'other');
  assert.equal(grouped[0].subgroups[0].id, 'otherUnclassified');
});

test('group and act order does not depend on API input order', () => {
  const input = [
    act('fed_estg', 'EStG'),
    act('fed_aufenthv', 'AufenthV'),
    act('fed_aufenthg_2004', 'AufenthG'),
    act('fed_sgb_2', 'SGB 2'),
  ];
  assert.deepEqual(groupLawIndexActs(input), groupLawIndexActs([...input].reverse()));
  assert.deepEqual(groupLawIndexActs(input).map(({ id }) => id), [
    'migration', 'social', 'tax',
  ]);
});
