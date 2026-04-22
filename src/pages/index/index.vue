<template>
  <view class="page">
    <view class="hero-card">
      <view class="hero-main">
        <view>
          <view class="hero-title">总进球数</view>
          <view class="hero-subtitle">单场总进球数（过关方式：单关）</view>
          <view class="hero-subtitle Disclaimer">*本工具仅用于赔率分配辅助与结果测算，不构成任何投注建议，请理性判断并谨慎参与。*</view>
        </view>
        <view class="hero-meta">
          <text class="meta-pill">更新时间：{{ updateTimeText }}</text>
          <text class="meta-pill">数据来源：sporttery.cn</text>
        </view>
      </view>
    </view>

    <view class="desktop-layout">
      <view class="desktop-main">
        <view class="card card-spacious">
          <view class="card-header card-header-compact">
            <view class="section-title">比赛选择</view>
            <view class="lock-control">
              <text class="lock-control-label">锁定赔率</text>
              <nut-switch v-model="formLocked" active-color="#36cfc9" inactive-color="#cbd5e1" />
            </view>
          </view>

          <view class="selector-wrap desktop-only">
            <nut-input
              v-model="selectedMatchLabel"
              readonly
              placeholder="请选择比赛或切换为自定义赔率"
              @click="desktopPopupVisible = true"
            >
              <template #right>
                <view class="selector-action">选择</view>
              </template>
            </nut-input>
          </view>

          <view class="selector-wrap mobile-only">
            <picker
              mode="selector"
              :range="pickerLabels"
              :value="selectedPickerIndex"
              @change="handleMatchChange"
            >
              <view class="picker-field">
                <text class="picker-text ellipsis">{{ selectedMatchLabel || '请选择比赛或切换为自定义赔率' }}</text>
                <text class="picker-arrow">›</text>
              </view>
            </picker>
          </view>
        </view>

        <view class="card card-spacious">
          <view class="section-title section-title-spaced">赔率输入</view>
          <view v-if="formLocked" class="lock-tip-inline">当前为锁定状态，点击右上角开关可解锁编辑</view>
          <view class="odds-grid">
            <view
              v-for="item in oddsFields"
              :key="item.key"
              class="odds-item"
              :class="{ 'odds-item-error': fieldErrors[item.key] }"
            >
              <view class="odds-input-shell" :class="{ 'odds-input-shell-locked': formLocked }">
                <view class="odds-label-row">
                  <view class="odds-label">{{ item.label }}</view>
                </view>
                <view class="odds-value-wrap">
                  <input
                    class="odds-native-input"
                    type="digit"
                    :disabled="formLocked"
                    :value="displayOddsValue(item.key)"
                    :placeholder="formLocked ? '当前已锁定，点击右上角解锁' : '请输入赔率'"
                    @input="($event) => handleOddsNativeInput(item.key, $event)"
                    @click="handleLockedOddsClick"
                  />
                </view>
              </view>
              <view v-if="fieldErrors[item.key]" class="field-error">请填写有效赔率</view>
            </view>
          </view>
        </view>
      </view>

      <view class="desktop-side">
        <view class="card card-spacious sticky-card">
          <view class="section-title section-title-spaced">预算设置</view>
          <view class="strategy-panel">
            <view class="strategy-label">投注策略</view>
            <view class="strategy-options">
              <view
                v-for="item in strategyOptions"
                :key="item.value"
                class="strategy-chip"
                :class="{ 'strategy-chip-active': strategyMode === item.value }"
                @tap="handleStrategyChange(item.value)"
              >
                {{ item.label }}
              </view>
            </view>
            <view class="strategy-tip">{{ currentStrategyDescription }}</view>
          </view>
          <view class="budget-box" :class="{ 'budget-box-error': principalError }">
            <text class="currency-symbol">￥</text>
            <nut-input
              class="budget-input"
              :model-value="principalInput"
              type="number"
              placeholder="请输入预计投入(最低16)"
              input-align="left"
              @update:model-value="handlePrincipalInput"
            />
          </view>
          <view class="budget-tip">系统会自动按 2 元/股 修正为偶数金额</view>
          <view v-if="principalError" class="field-error">请输入不小于 16 的有效预算</view>

          <nut-button block type="primary" class="calc-button" @click="handleCalculate">开始计算</nut-button>
        </view>

        <view v-if="resultRows.length" class="card card-spacious">
          <view class="section-title section-title-spaced">计算结果</view>
          <view class="summary-box">
            <view class="summary-item">
              <text class="summary-label">实际预算</text>
              <text class="summary-value">￥{{ normalizedPrincipal }}</text>
            </view>
            <view class="summary-item">
              <text class="summary-label">当前策略</text>
              <text class="summary-value">{{ currentStrategyLabel }}</text>
            </view>
            <view class="summary-item">
              <text class="summary-label">盈利档数</text>
              <text class="summary-value">{{ profitableResultCount }} / {{ oddsFields.length }}</text>
            </view>
            <view class="summary-item summary-item-column">
              <text class="summary-label">建议结论</text>
              <text class="summary-value summary-value-highlight">{{ recommendationText }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view v-if="resultRows.length" class="card card-spacious result-card">
      <view class="section-title section-title-spaced">结果明细</view>
      <view class="result-table desktop-only">
        <view class="table-header table-row">
          <text class="col-goal">进球数</text>
          <text class="col-share">预期投入股</text>
          <text class="col-amount">投入金额</text>
          <text class="col-return">预期回报</text>
        </view>
        <view v-for="row in resultRows" :key="row.NumberOfGoals" class="table-row">
          <text class="col-goal">{{ row.NumberOfGoalsLabel }}</text>
          <text class="col-share">{{ row.ExpectedInput }}</text>
          <text class="col-amount">￥{{ row.AmountInvested }}</text>
          <text class="col-return ellipsis" :class="getReturnClass(row.ExpectedReturn)">￥{{ row.ExpectedReturn }}</text>
        </view>
      </view>

      <view class="mobile-only mobile-result-list">
        <view v-for="row in resultRows" :key="row.NumberOfGoals" class="mobile-result-item">
          <view class="mobile-result-top">
            <text class="mobile-goal-tag">{{ row.NumberOfGoalsLabel }}</text>
            <text class="mobile-return" :class="getReturnClass(row.ExpectedReturn)">￥{{ row.ExpectedReturn }}</text>
          </view>
          <view class="mobile-result-meta">
            <text>投入股数：{{ row.ExpectedInput }}</text>
            <text>投入金额：￥{{ row.AmountInvested }}</text>
          </view>
        </view>
      </view>
    </view>

    <nut-popup v-model:visible="desktopPopupVisible" position="bottom" round>
      <view class="popup-panel">
        <view class="popup-header">
          <text class="popup-title">选择比赛</text>
          <text class="popup-close" @tap="desktopPopupVisible = false">关闭</text>
        </view>
        <scroll-view scroll-y class="popup-list">
          <view
            v-for="item in options"
            :key="item.value"
            class="popup-option"
            :class="{
              'popup-option-active': item.value === selectedMatchValue,
              'popup-option-disabled': item.disabled
            }"
            @tap="selectMatch(item)"
          >
            <view v-if="item.disabled" class="popup-option-group ellipsis">{{ item.label }}</view>
            <template v-else>
              <view class="popup-option-top">
                <text class="popup-flag">{{ item.flag || '🏳️' }}</text>
                <text class="popup-league ellipsis">{{ item.leagueName || '未知赛事' }}</text>
              </view>
              <text class="popup-match ellipsis">{{ item.label }}</text>
            </template>
          </view>
        </scroll-view>
      </view>
    </nut-popup>
  </view>
</template>

<script setup lang="ts">
import Taro from '@tarojs/taro'
import { computed, onMounted, reactive, ref } from 'vue'
import {
  DEFAULT_ODDS,
  DEFAULT_STRATEGY,
  GOAL_KEYS,
  GOAL_LABELS,
  buildResultRows,
  calculatePlan,
  getRecommendation,
  normalizePrincipal,
  parseOddsList
} from '../../utils/lotteryCalculator'
import { parseRemoteMatchOdds } from '../../utils/matchOdds'
import type { MatchOdds, ResultRow, StrategyKey } from '../../utils/lotteryCalculator'

// 比赛选择器里每个选项的数据结构。
type MatchOption = {
  label: string
  value: string
  ttg: MatchOdds
  disabled?: boolean
  displayLabel?: string
  leagueName?: string
  flag?: string
}

// 页面固定展示的 8 个总进球赔率输入项。
const oddsFields = GOAL_LABELS.map((label, index) => ({
  label,
  key: GOAL_KEYS[index]
}))

// 比赛列表，默认先放一个“自定义赔率”兜底选项。
const options = ref<MatchOption[]>([
  {
    label: '自定义',
    displayLabel: '⚙️ 自定义赔率',
    leagueName: '手动输入',
    flag: '⚙️',
    value: 'none',
    ttg: { ...DEFAULT_ODDS }
  }
])
// 页面核心状态。
const selectedMatchValue = ref('none')
const formLocked = ref(false)
const desktopPopupVisible = ref(false)
const updateTimeText = ref('加载中')
const principalInput = ref('')
const normalizedPrincipal = ref(0)
const recommendationText = ref('尚未计算')
const resultRows = ref<ResultRow[]>([])
const fieldErrors = reactive<Record<string, boolean>>({})
const principalError = ref(false)
const strategyMode = ref<StrategyKey>(DEFAULT_STRATEGY)

const strategyOptions: { label: string; value: StrategyKey; description: string }[] = [
  {
    label: '稳健',
    value: 'balanced',
    description: '更偏向保护低赔率结果，覆盖相对集中，适合先看保守分布。'
  },
  {
    label: '激进',
    value: 'aggressive',
    description: '兼顾低赔率保护和收益扩张，适合大多数场景先试。'
  },
  {
    label: '冲刺',
    value: 'all-in',
    description: '更愿意把预算压向更高回报区间，覆盖更广，也更冒险。'
  }
]

// 赔率输入表单，key 与 GOAL_KEYS 一一对应。
const oddsForm = reactive<Record<typeof GOAL_KEYS[number], string>>({
  s0: '',
  s1: '',
  s2: '',
  s3: '',
  s4: '',
  s5: '',
  s6: '',
  s7: ''
})

GOAL_KEYS.forEach((key) => {
  fieldErrors[key] = false
})

// 给移动端 picker 和桌面端已选状态准备衍生数据。
const pickerOptions = computed(() => options.value.filter((item) => !item.disabled))
const pickerLabels = computed(() => pickerOptions.value.map((item) => item.displayLabel || item.label))
const selectedPickerIndex = computed(() => {
  const index = pickerOptions.value.findIndex((item) => item.value === selectedMatchValue.value)
  return index >= 0 ? index : 0
})
const selectedMatchLabel = computed(() => {
  const current = pickerOptions.value.find((item) => item.value === selectedMatchValue.value)
  return current?.displayLabel || current?.label || ''
})
const currentStrategyDescription = computed(() => {
  return strategyOptions.find((item) => item.value === strategyMode.value)?.description || ''
})
const currentStrategyLabel = computed(() => {
  return strategyOptions.find((item) => item.value === strategyMode.value)?.label || ''
})
const profitableResultCount = computed(() => {
  return resultRows.value.filter((row) => row.ExpectedReturn >= normalizedPrincipal.value).length
})

// 把联赛 code / 名称映射成可展示的国旗或赛事图标。
function getLeaguePresentation(leagueCode?: string, leagueName?: string) {
  const code = leagueCode || ''
  const name = leagueName || ''

  const directMap: Record<string, { flag: string; leagueName?: string }> = {
    KD1: { flag: '🇰🇷' },
    KOR: { flag: '🇰🇷' },
    J1L: { flag: '🇯🇵' },
    J2L: { flag: '🇯🇵' },
    SFL: { flag: '🇪🇸' },
    EDP: { flag: '🏴' },
    ED1: { flag: '🏴' },
    EPL: { flag: '🏴' },
    IFA: { flag: '🇮🇹' },
    IFC: { flag: '🇮🇹' },
    DFL: { flag: '🇩🇪' },
    FD1: { flag: '🇫🇷' },
    PDL: { flag: '🇵🇹' },
    NHL: { flag: '🇳🇱' },
    BDL: { flag: '🇧🇪' },
    TSL: { flag: '🇹🇷' },
    RPL: { flag: '🇷🇺' },
    GSL: { flag: '🇬🇷' },
    SWD: { flag: '🇸🇪' },
    NOR: { flag: '🇳🇴' },
    DEN: { flag: '🇩🇰' },
    FIN: { flag: '🇫🇮' },
    USA: { flag: '🇺🇸' },
    BRA: { flag: '🇧🇷' },
    ARG: { flag: '🇦🇷' },
    ACL: { flag: '🏆', leagueName: '亚冠精英' },
    UCL: { flag: '🏆', leagueName: '欧冠' },
    UEL: { flag: '🏆', leagueName: '欧联' },
    UNE: { flag: '🏆', leagueName: '欧国联' }
  }

  if (directMap[code]) {
    return {
      flag: directMap[code].flag,
      leagueName: directMap[code].leagueName || name || code
    }
  }

  const fallbackRules = [
    { keyword: '韩国', flag: '🇰🇷' },
    { keyword: '韩职', flag: '🇰🇷' },
    { keyword: '日本', flag: '🇯🇵' },
    { keyword: '日职', flag: '🇯🇵' },
    { keyword: '英格兰', flag: '🏴' },
    { keyword: '英超', flag: '🏴' },
    { keyword: '英冠', flag: '🏴' },
    { keyword: '西班牙', flag: '🇪🇸' },
    { keyword: '西甲', flag: '🇪🇸' },
    { keyword: '意大利', flag: '🇮🇹' },
    { keyword: '意甲', flag: '🇮🇹' },
    { keyword: '意大利杯', flag: '🇮🇹' },
    { keyword: '德国', flag: '🇩🇪' },
    { keyword: '德甲', flag: '🇩🇪' },
    { keyword: '法国', flag: '🇫🇷' },
    { keyword: '法甲', flag: '🇫🇷' },
    { keyword: '葡萄牙', flag: '🇵🇹' },
    { keyword: '荷兰', flag: '🇳🇱' },
    { keyword: '比利时', flag: '🇧🇪' },
    { keyword: '土耳其', flag: '🇹🇷' },
    { keyword: '俄罗斯', flag: '🇷🇺' },
    { keyword: '希腊', flag: '🇬🇷' },
    { keyword: '瑞典', flag: '🇸🇪' },
    { keyword: '挪威', flag: '🇳🇴' },
    { keyword: '丹麦', flag: '🇩🇰' },
    { keyword: '芬兰', flag: '🇫🇮' },
    { keyword: '美国', flag: '🇺🇸' },
    { keyword: '巴西', flag: '🇧🇷' },
    { keyword: '阿根廷', flag: '🇦🇷' },
    { keyword: '亚冠', flag: '🏆' },
    { keyword: '欧冠', flag: '🏆' },
    { keyword: '欧联', flag: '🏆' },
    { keyword: '杯', flag: '🏆' }
  ]

  const matched = fallbackRules.find((rule) => name.includes(rule.keyword))
  return {
    flag: matched?.flag || '🏳️',
    leagueName: name || code || '未知赛事'
  }
}

// 生成比赛项的最终展示文案，例如：🇪🇸 西甲 · 巴伦西亚 VS 马洛卡
function formatMatchOptionLabel(matchName: string, leagueName?: string, flag?: string) {
  const prefix = [flag, leagueName].filter(Boolean).join(' ')
  return prefix ? `${prefix} · ${matchName}` : matchName
}

// 页面统一 toast 提示入口。
function showToast(title: string, icon: 'none' | 'success' | 'error' = 'none') {
  Taro.showToast({ title, icon, duration: 1800 })
}

// 选择比赛后，把接口里的赔率写回页面输入框。
function setOddsFromMatch(ttg: MatchOdds) {
  GOAL_KEYS.forEach((key) => {
    oddsForm[key] = String(ttg[key])
    fieldErrors[key] = false
  })
}

function displayOddsValue(key: typeof GOAL_KEYS[number]) {
  return oddsForm[key]
}

// 校验页面输入框，同时把字段错误状态同步回 UI。
function validateOddsForm() {
  const parsed = parseOddsList(oddsForm)
  GOAL_KEYS.forEach((key) => {
    fieldErrors[key] = Boolean(parsed.fieldErrors[key])
  })
  return parsed
}

function resetResults() {
  resultRows.value = []
  recommendationText.value = '尚未计算'
}

function handleStrategyChange(value: StrategyKey) {
  strategyMode.value = value
  resetResults()
}

// 计算按钮主流程：校验 -> 归一化预算 -> 调算法 -> 生成结果表
function handleCalculate() {
  const principalMeta = normalizePrincipal(principalInput.value)
  principalError.value = !principalMeta.isValid
  const { hasError, values } = validateOddsForm()

  if (principalError.value) {
    showToast('请输入不小于16元的预算', 'error')
    resetResults()
    return
  }

  if (hasError) {
    showToast('请先补全全部赔率', 'error')
    resetResults()
    return
  }

  const principal = principalMeta.normalized
  normalizedPrincipal.value = principal

  const allocations = calculatePlan(values, principal, strategyMode.value)
  const hasInvalidAllocation = allocations.some((item) => item <= 0)
  if (hasInvalidAllocation) {
    showToast('赔率或投入金额过小', 'error')
    resetResults()
    return
  }

  const rows = buildResultRows(allocations, values)

  resultRows.value = rows
  recommendationText.value = getRecommendation(rows, principal)
  showToast('计算成功', 'success')
}

// 通用赔率输入更新函数。
function handleOddsInput(key: typeof GOAL_KEYS[number], value: string) {
  oddsForm[key] = value ?? ''
  fieldErrors[key] = false
  resetResults()
}

function handleOddsNativeInput(key: typeof GOAL_KEYS[number], event: Event) {
  const target = event.target as HTMLInputElement | null
  handleOddsInput(key, target?.value ?? '')
}

// 锁定状态下点击赔率输入框时，给用户一个轻提示。
function handleLockedOddsClick() {
  if (!formLocked.value) {
    return
  }
  showToast('当前赔率已锁定，点击右上角开关可解锁', 'none')
}

// 根据回报与总投入的关系，返回不同的颜色 class。
function getReturnClass(expectedReturn: number) {
  if (!normalizedPrincipal.value) {
    return ''
  }

  const diffRatio = (expectedReturn - normalizedPrincipal.value) / normalizedPrincipal.value
  if (Math.abs(diffRatio) <= 0.02) {
    return 'mobile-return-warning'
  }

  if (expectedReturn > normalizedPrincipal.value) {
    return 'mobile-return-profit'
  }

  return 'mobile-return-loss'
}

function handlePrincipalInput(value: string) {
  principalInput.value = value ?? ''
  principalError.value = false
  resetResults()
}

function handleMatchChange(event: { detail: { value: string } }) {
  const pickerIndex = Number(event.detail.value)
  const current = pickerOptions.value[pickerIndex]
  if (!current) {
    return
  }
  selectMatch(current)
}

function selectMatch(item: MatchOption) {
  if (item.disabled) {
    return
  }
  selectedMatchValue.value = item.value
  setOddsFromMatch(item.ttg)
  formLocked.value = item.value !== 'none'
  desktopPopupVisible.value = false
  resetResults()
}

// 拉取体彩接口比赛数据，并转换成页面选择器需要的结构。
async function fetchMatchData() {
  try {
    const response = await Taro.request({
      url: 'https://webapi.sporttery.cn/gateway/jc/football/getMatchCalculatorV1.qry?poolCode=ttg&channel=c',
      method: 'GET'
    })

    const payload = response.data as {
      value?: {
        lastUpdateTime?: string
        matchInfoList?: Array<{
          weekday: string
          businessDate: string
          subMatchList?: Array<{
            awayTeamAllName: string
            homeTeamAbbName: string
            leagueCode?: string
            leagueAbbName?: string
            leagueAllName?: string
            ttg?: Partial<Record<keyof MatchOdds, unknown>> | null
          }>
        }>
      }
    }

    const matchInfoList = payload?.value?.matchInfoList || []
    updateTimeText.value = payload?.value?.lastUpdateTime || '暂无'

    const dynamicOptions: MatchOption[] = [
      {
        label: '自定义',
        displayLabel: '⚙️ 自定义赔率',
        leagueName: '手动输入',
        flag: '⚙️',
        value: 'none',
        ttg: { ...DEFAULT_ODDS }
      }
    ]

    matchInfoList.forEach((weekGroup, weekIndex) => {
      const weekLabel = `${weekGroup.weekday} (${weekGroup.businessDate})`
      const weekOptions: MatchOption[] = []

      weekGroup.subMatchList?.forEach((match, matchIndex) => {
        const parsedOdds = parseRemoteMatchOdds(match.ttg)
        if (!parsedOdds) {
          return
        }

        const matchName = `${match.awayTeamAllName} VS ${match.homeTeamAbbName}`
        const presentation = getLeaguePresentation(match.leagueCode, match.leagueAllName || match.leagueAbbName)

        weekOptions.push({
          label: matchName,
          displayLabel: formatMatchOptionLabel(matchName, presentation.leagueName, presentation.flag),
          leagueName: presentation.leagueName,
          flag: presentation.flag,
          value: `week${weekIndex}-${matchIndex}`,
          ttg: parsedOdds
        })
      })

      if (weekOptions.length > 0) {
        dynamicOptions.push({
          label: weekLabel,
          value: `group-${weekIndex}`,
          ttg: { ...DEFAULT_ODDS },
          disabled: true
        })
        dynamicOptions.push(...weekOptions)
      }
    })

    options.value = dynamicOptions
  } catch (error) {
    updateTimeText.value = '获取失败'
    options.value = [
      {
        label: '自定义',
        displayLabel: '⚙️ 自定义赔率',
        leagueName: '手动输入',
        flag: '⚙️',
        value: 'none',
        ttg: { ...DEFAULT_ODDS }
      }
    ]
    showToast('比赛列表获取失败，已切换为手动输入', 'error')
  }
}

// 页面初始化：先放默认赔率，再尝试拉取实时比赛。
onMounted(() => {
  setOddsFromMatch(DEFAULT_ODDS)
  fetchMatchData()
})
</script>

<style src="./index.scss" lang="scss" scoped></style>
