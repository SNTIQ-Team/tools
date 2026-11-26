import type { KerfAct } from './client';

/**
 * Curated topic navigation for the deep Kerf corpus.
 *
 * These are browsing facets, not levels of law, competences or statements
 * about priority.  Classification is deliberately based on stable corpus ids
 * rather than fuzzy title matching: an unfamiliar act stays in `other`
 * instead of receiving a plausible-looking but unverified legal topic.
 */
export const LAW_INDEX_GROUPS = [
  {
    id: 'migration',
    subgroups: ['migrationResidence', 'migrationAsylum', 'migrationCitizenship'],
  },
  {
    id: 'social',
    subgroups: ['socialGeneral', 'socialIncome', 'socialFamily', 'socialInsurance', 'socialEmployment'],
  },
  {
    id: 'labour',
    subgroups: ['labourConditions', 'labourProtection', 'labourCollective'],
  },
  {
    id: 'justice',
    subgroups: ['justiceCivil', 'justiceFamily', 'justiceCriminal', 'justicePublicCourts', 'justiceServices'],
  },
  {
    id: 'government',
    subgroups: ['governmentConstitution', 'governmentProcedure', 'governmentDigital', 'governmentRecords', 'governmentSecurity'],
  },
  {
    id: 'education',
    subgroups: ['educationSchool', 'educationSupport', 'educationVocational'],
  },
  {
    id: 'tax',
    subgroups: ['taxIncome', 'taxProperty', 'taxBusiness', 'taxProcedure'],
  },
  {
    id: 'commerce',
    subgroups: ['commerceBusiness', 'commerceMarkets', 'commerceFinance'],
  },
  {
    id: 'housing',
    subgroups: ['housingPlanning', 'housingResidential'],
  },
  {
    id: 'environment',
    subgroups: ['environmentProtection', 'environmentEnergy', 'environmentResources'],
  },
  {
    id: 'transport',
    subgroups: ['transportRoad', 'transportVehicles'],
  },
  {
    id: 'health',
    subgroups: ['healthPublic', 'healthProducts', 'healthProfessions'],
  },
  {
    id: 'other',
    subgroups: ['otherUnclassified'],
  },
] as const;

export type LawIndexGroupId = typeof LAW_INDEX_GROUPS[number]['id'];
export type LawIndexSubgroupId = typeof LAW_INDEX_GROUPS[number]['subgroups'][number];

type Topic = readonly [LawIndexGroupId, LawIndexSubgroupId];

const TOPIC_BY_ACT_ID: Record<string, Topic> = {
  // Migration, asylum and citizenship
  fed_aufenthg_2004: ['migration', 'migrationResidence'],
  fed_aufenthv: ['migration', 'migrationResidence'],
  fed_beschv_2013: ['migration', 'migrationResidence'],
  fed_dbv: ['migration', 'migrationResidence'],
  fed_deuf_v: ['migration', 'migrationResidence'],
  fed_freiz_gg_eu_2004: ['migration', 'migrationResidence'],
  fed_hauslg: ['migration', 'migrationResidence'],
  fed_intv: ['migration', 'migrationResidence'],
  fed_ukraineaufenth_v: ['migration', 'migrationResidence'],
  fed_ukraineaufenthfgv: ['migration', 'migrationResidence'],
  by_bayintg: ['migration', 'migrationResidence'],
  by_zustvauslr: ['migration', 'migrationResidence'],
  fed_aknv: ['migration', 'migrationAsylum'],
  fed_asylblg: ['migration', 'migrationAsylum'],
  fed_asylvfg_1992: ['migration', 'migrationAsylum'],
  fed_asylzbv_2026: ['migration', 'migrationAsylum'],
  by_aufng: ['migration', 'migrationAsylum'],
  by_dvasyl: ['migration', 'migrationAsylum'],
  fed_azrg: ['migration', 'migrationCitizenship'],
  fed_azrg_dv: ['migration', 'migrationCitizenship'],
  fed_bvfg: ['migration', 'migrationCitizenship'],
  fed_einbtestv: ['migration', 'migrationCitizenship'],
  fed_rustag: ['migration', 'migrationCitizenship'],
  fed_viszg: ['migration', 'migrationCitizenship'],
  fed_vwdg: ['migration', 'migrationCitizenship'],
  fed_vwdg_dv: ['migration', 'migrationCitizenship'],

  // Social protection and benefits
  fed_sgb_1: ['social', 'socialGeneral'],
  fed_sgb_4: ['social', 'socialGeneral'],
  fed_sgb_10: ['social', 'socialGeneral'],
  fed_beitrvv: ['social', 'socialGeneral'],
  fed_de_v: ['social', 'socialGeneral'],
  fed_grsidav: ['social', 'socialGeneral'],
  fed_sozhidav_2019: ['social', 'socialGeneral'],
  fed_svev: ['social', 'socialGeneral'],
  by_agsg: ['social', 'socialGeneral'],
  fed_sgb_2: ['social', 'socialIncome'],
  fed_sgb_12: ['social', 'socialIncome'],
  fed_rbeg_2021: ['social', 'socialIncome'],
  fed_wogg: ['social', 'socialIncome'],
  fed_beg: ['social', 'socialIncome'],
  fed_algiiv_2008: ['social', 'socialIncome'],
  fed_bshg_76dv: ['social', 'socialIncome'],
  fed_bshg_88abs2dv_1988: ['social', 'socialIncome'],
  fed_wogv: ['social', 'socialIncome'],
  fed_sgb_8: ['social', 'socialFamily'],
  fed_beeg: ['social', 'socialFamily'],
  fed_bkgg_1996: ['social', 'socialFamily'],
  fed_uhvorschg: ['social', 'socialFamily'],
  fed_advermig_1976: ['social', 'socialFamily'],
  fed_kkg: ['social', 'socialFamily'],
  fed_sgb_5: ['social', 'socialInsurance'],
  fed_sgb_6: ['social', 'socialInsurance'],
  fed_sgb_7: ['social', 'socialInsurance'],
  fed_sgb_9_2018: ['social', 'socialInsurance'],
  fed_sgb_11: ['social', 'socialInsurance'],
  fed_sgb_14: ['social', 'socialInsurance'],
  fed_betravg: ['social', 'socialInsurance'],
  fed_bgg: ['social', 'socialInsurance'],
  fed_bkv: ['social', 'socialInsurance'],
  fed_rvo: ['social', 'socialInsurance'],
  fed_schwbawv: ['social', 'socialInsurance'],
  fed_sozsichabkg_ukr: ['social', 'socialInsurance'],
  fed_versmedv: ['social', 'socialInsurance'],
  fed_sgb_3: ['social', 'socialEmployment'],

  // Labour and equal treatment
  fed_arbzg: ['labour', 'labourConditions'],
  fed_milog: ['labour', 'labourConditions'],
  fed_entgfg: ['labour', 'labourConditions'],
  fed_a_g: ['labour', 'labourConditions'],
  fed_aentg_2009: ['labour', 'labourConditions'],
  fed_burlg: ['labour', 'labourConditions'],
  fed_entgtranspg: ['labour', 'labourConditions'],
  fed_fpfzg: ['labour', 'labourConditions'],
  fed_nachwg: ['labour', 'labourConditions'],
  fed_pflegezg: ['labour', 'labourConditions'],
  fed_tzbfg: ['labour', 'labourConditions'],
  fed_kschg: ['labour', 'labourProtection'],
  fed_agg: ['labour', 'labourProtection'],
  fed_arbschg: ['labour', 'labourProtection'],
  fed_asig: ['labour', 'labourProtection'],
  fed_hinschg: ['labour', 'labourProtection'],
  fed_jarbschg: ['labour', 'labourProtection'],
  fed_muschg_2018: ['labour', 'labourProtection'],
  fed_schwarzarbg_2004: ['labour', 'labourProtection'],
  fed_betrvg: ['labour', 'labourCollective'],
  fed_schwbwo: ['labour', 'labourCollective'],
  fed_tvg: ['labour', 'labourCollective'],

  // Justice and legal protection
  fed_bgb: ['justice', 'justiceCivil'],
  fed_zpo: ['justice', 'justiceCivil'],
  fed_gewschg: ['justice', 'justiceCivil'],
  fed_berathig: ['justice', 'justiceCivil'],
  fed_bgbeg: ['justice', 'justiceCivil'],
  fed_inso: ['justice', 'justiceCivil'],
  fed_zvg: ['justice', 'justiceCivil'],
  fed_adwirkg: ['justice', 'justiceFamily'],
  fed_aug_2011: ['justice', 'justiceFamily'],
  fed_btog: ['justice', 'justiceFamily'],
  fed_famfg: ['justice', 'justiceFamily'],
  fed_lpartg: ['justice', 'justiceFamily'],
  fed_vbvg_2023: ['justice', 'justiceFamily'],
  fed_versausglg: ['justice', 'justiceFamily'],
  fed_stgb: ['justice', 'justiceCriminal'],
  fed_stpo: ['justice', 'justiceCriminal'],
  fed_bzrg: ['justice', 'justiceCriminal'],
  fed_jgg: ['justice', 'justiceCriminal'],
  fed_owig_1968: ['justice', 'justiceCriminal'],
  fed_stgbeg: ['justice', 'justiceCriminal'],
  fed_stpoeg: ['justice', 'justiceCriminal'],
  fed_vwgo: ['justice', 'justicePublicCourts'],
  fed_sgg: ['justice', 'justicePublicCourts'],
  fed_arbgg: ['justice', 'justicePublicCourts'],
  fed_fgo: ['justice', 'justicePublicCourts'],
  fed_gvg: ['justice', 'justicePublicCourts'],
  fed_gvgeg: ['justice', 'justicePublicCourts'],
  by_agvwgo: ['justice', 'justicePublicCourts'],
  fed_famgkg: ['justice', 'justiceServices'],
  fed_gkg_2004: ['justice', 'justiceServices'],
  fed_jveg: ['justice', 'justiceServices'],
  fed_rdg: ['justice', 'justiceServices'],
  fed_rvg: ['justice', 'justiceServices'],

  // Constitution, administration and security
  fed_gg: ['government', 'governmentConstitution'],
  fed_bverfgg: ['government', 'governmentConstitution'],
  by_bayverf: ['government', 'governmentConstitution'],
  fed_vwvfg: ['government', 'governmentProcedure'],
  fed_vwvg: ['government', 'governmentProcedure'],
  fed_vwzg_2005: ['government', 'governmentProcedure'],
  by_bayvwvfg: ['government', 'governmentProcedure'],
  by_vwzvg: ['government', 'governmentProcedure'],
  fed_ozg: ['government', 'governmentDigital'],
  fed_idnrg: ['government', 'governmentDigital'],
  fed_bdsg_2018: ['government', 'governmentDigital'],
  fed_bitv_2_0: ['government', 'governmentDigital'],
  fed_ifg: ['government', 'governmentDigital'],
  fed_bmg: ['government', 'governmentRecords'],
  fed_nam_ndg: ['government', 'governmentRecords'],
  fed_pa_g_1986: ['government', 'governmentRecords'],
  fed_pauswg: ['government', 'governmentRecords'],
  fed_pstg: ['government', 'governmentRecords'],
  fed_pstv: ['government', 'governmentRecords'],
  fed_sbgg: ['government', 'governmentRecords'],
  fed_waffg_2002: ['government', 'governmentSecurity'],
  by_pag: ['government', 'governmentSecurity'],
  by_lstvg: ['government', 'governmentSecurity'],

  // Education
  by_bayeug: ['education', 'educationSchool'],
  fed_baf_g: ['education', 'educationSupport'],
  fed_bbig_2005: ['education', 'educationVocational'],
  fed_bqfg: ['education', 'educationVocational'],
  fed_fernusg: ['education', 'educationVocational'],

  // Taxation
  fed_estg: ['tax', 'taxIncome'],
  fed_invstg_2018: ['tax', 'taxIncome'],
  fed_kstg_1977: ['tax', 'taxIncome'],
  fed_solzg_1995: ['tax', 'taxIncome'],
  fed_bewg: ['tax', 'taxProperty'],
  fed_erbstg_1974: ['tax', 'taxProperty'],
  fed_grstg_1973: ['tax', 'taxProperty'],
  fed_gewstg: ['tax', 'taxBusiness'],
  fed_ustdv_1980: ['tax', 'taxBusiness'],
  fed_ustg_1980: ['tax', 'taxBusiness'],
  fed_ao_1977: ['tax', 'taxProcedure'],
  fed_fvg_1971: ['tax', 'taxProcedure'],

  // Business, markets and financial services
  fed_aktg: ['commerce', 'commerceBusiness'],
  fed_gastg: ['commerce', 'commerceBusiness'],
  fed_gewo: ['commerce', 'commerceBusiness'],
  fed_gmbhg: ['commerce', 'commerceBusiness'],
  fed_hgb: ['commerce', 'commerceBusiness'],
  fed_hwo: ['commerce', 'commerceBusiness'],
  fed_ihkg: ['commerce', 'commerceBusiness'],
  fed_prostschg: ['commerce', 'commerceBusiness'],
  fed_umwg_1995: ['commerce', 'commerceBusiness'],
  fed_ddg: ['commerce', 'commerceMarkets'],
  fed_geschgehg: ['commerce', 'commerceMarkets'],
  fed_prodhaftg: ['commerce', 'commerceMarkets'],
  fed_tkg_2021: ['commerce', 'commerceMarkets'],
  fed_uklag: ['commerce', 'commerceMarkets'],
  fed_uwg_2004: ['commerce', 'commerceMarkets'],
  fed_vsbg: ['commerce', 'commerceMarkets'],
  fed_kredwg: ['commerce', 'commerceFinance'],
  fed_vvg_2008: ['commerce', 'commerceFinance'],
  fed_zag_2018: ['commerce', 'commerceFinance'],

  // Housing and construction
  fed_baunvo: ['housing', 'housingPlanning'],
  fed_bbaug: ['housing', 'housingPlanning'],
  fed_geg: ['housing', 'housingPlanning'],
  fed_wobindg: ['housing', 'housingPlanning'],
  fed_wofg: ['housing', 'housingPlanning'],
  fed_heizkostenv: ['housing', 'housingResidential'],
  fed_wbvg: ['housing', 'housingResidential'],
  fed_woeigg: ['housing', 'housingResidential'],
  fed_woflv: ['housing', 'housingResidential'],
  fed_wovermrg: ['housing', 'housingResidential'],

  // Environment, energy and resources
  fed_bimschg: ['environment', 'environmentProtection'],
  fed_bnatschg_2009: ['environment', 'environmentProtection'],
  fed_avbfernw_rmev: ['environment', 'environmentEnergy'],
  fed_eeg_2014: ['environment', 'environmentEnergy'],
  fed_enwg_2005: ['environment', 'environmentEnergy'],
  fed_nav: ['environment', 'environmentEnergy'],
  fed_ndav: ['environment', 'environmentEnergy'],
  fed_avbwasserv: ['environment', 'environmentResources'],
  fed_krwg: ['environment', 'environmentResources'],
  fed_whg_2009: ['environment', 'environmentResources'],

  // Transport
  fed_fev_2010: ['transport', 'transportRoad'],
  fed_stvg: ['transport', 'transportRoad'],
  fed_stvo_2013: ['transport', 'transportRoad'],
  fed_fzv_2023: ['transport', 'transportVehicles'],
  fed_pflvg: ['transport', 'transportVehicles'],
  fed_stvzo_2012: ['transport', 'transportVehicles'],

  // Health
  fed_beratungsg: ['health', 'healthPublic'],
  fed_ifsg: ['health', 'healthPublic'],
  fed_amg_1976: ['health', 'healthProducts'],
  fed_btmg_1981: ['health', 'healthProducts'],
  fed_kcang: ['health', 'healthProducts'],
  fed_mpdg: ['health', 'healthProducts'],
  fed_b_o: ['health', 'healthProfessions'],
  fed_pflbg: ['health', 'healthProfessions'],
};

export const CURATED_LAW_INDEX_ACT_IDS = Object.freeze(Object.keys(TOPIC_BY_ACT_ID));

export const classifyLawIndexAct = (
  act: Pick<KerfAct, 'id'>,
): { groupId: LawIndexGroupId; subgroupId: LawIndexSubgroupId } => {
  const topic = TOPIC_BY_ACT_ID[act.id];
  return topic
    ? { groupId: topic[0], subgroupId: topic[1] }
    : { groupId: 'other', subgroupId: 'otherUnclassified' };
};

export interface LawIndexSubgroup<T extends Pick<KerfAct, 'id' | 'jurabk'>> {
  id: LawIndexSubgroupId;
  acts: T[];
}

export interface LawIndexGroup<T extends Pick<KerfAct, 'id' | 'jurabk'>> {
  id: LawIndexGroupId;
  subgroups: LawIndexSubgroup<T>[];
  count: number;
}

const actOrder = <T extends Pick<KerfAct, 'id' | 'jurabk'>>(a: T, b: T) => {
  const left = `${a.jurabk}\u0000${a.id}`.normalize('NFKD').toLowerCase();
  const right = `${b.jurabk}\u0000${b.id}`.normalize('NFKD').toLowerCase();
  return left < right ? -1 : left > right ? 1 : 0;
};

/** Group every act exactly once, in a stable curated group/subgroup order. */
export const groupLawIndexActs = <T extends Pick<KerfAct, 'id' | 'jurabk'>>(
  acts: readonly T[],
): LawIndexGroup<T>[] => {
  const buckets = new Map<LawIndexSubgroupId, T[]>();
  for (const act of acts) {
    const { subgroupId } = classifyLawIndexAct(act);
    const bucket = buckets.get(subgroupId);
    if (bucket) bucket.push(act);
    else buckets.set(subgroupId, [act]);
  }

  return LAW_INDEX_GROUPS.flatMap((group) => {
    const subgroups = group.subgroups.flatMap((id) => {
      const bucket = buckets.get(id);
      return bucket?.length ? [{ id, acts: [...bucket].sort(actOrder) }] : [];
    });
    const count = subgroups.reduce((sum, subgroup) => sum + subgroup.acts.length, 0);
    return count ? [{ id: group.id, subgroups, count }] : [];
  });
};
