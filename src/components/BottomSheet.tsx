/**
 * 下から出るシート（カレンダーの編集シート・保存しましたシートで共通。UI仕様 4章「シートの下スワイプ」）。
 *
 * - 開く・閉じるは自前の動き（下からスライド・背景の暗さ）。Modal 自体の動きは使わない
 * - 下へスワイプするとシートが指についてきて背景が薄くなる。高さの 1/4 超・素早く払う → onDragDismiss、足りなければ戻る
 *   （判定は src/domain/gestures.ts）。閉じたときはキーボードも閉じる
 * - 閉じない場面: dragBlocked（削除の確認中・処理中）・一言の入力欄の中から始めた操作（markInputTouch）・
 *   操作の開始時に中身が一番上でない（途中で一番上に達しても、その操作では閉じない）
 * - 外側のタップ・端末の戻る操作 → onRequestClose
 * - Android はキーボードの高さを下の余白にする（Transparent Modal の中では KeyboardAvoidingView が効かないため。既存の対処を引き継ぐ）
 *
 * 中身のスクロール: 中身が一番上のときは ScrollView のスクロールを止めておく（Android の ScrollView は一番上でも下向きの
 * ドラッグを奪うため、シートの下スワイプと両立しない）。一番上から上へ動かしたときはこの部品がスクロールさせ、
 * 一番上から離れたら ScrollView のスクロールに戻す。ScrollView のドラッグ・慣性が一番上で終わったら、また止める。
 *
 * ジェスチャーは React Native 標準の PanResponder・Animated だけで作る（新しいライブラリは入れない）。
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
  type PanResponderGestureState,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { canStartSheetDrag, decideSheetDismiss, lockSheetDrag } from '@/domain/gestures'
import { sheetBottomPadding } from '@/domain/sheetLayout'

export interface SheetApi {
  /** 一言の入力欄の onTouchStart に渡す（入力欄の中から始めた操作ではシートを動かさない） */
  markInputTouch: (e: GestureResponderEvent) => void
}

interface Props {
  visible: boolean
  /** 外側のタップ・端末の戻る操作 */
  onRequestClose: () => void
  /** 下スワイプで閉じたとき */
  onDragDismiss: () => void
  /** 削除の確認中・処理中など、下スワイプで閉じない状態 */
  dragBlocked?: boolean
  backgroundColor?: string
  /** シートの上に重ねるもの（削除の確認ダイアログなど） */
  overlay?: React.ReactNode
  /** 画面全体に重ねる、触れないもの（紙吹雪など） */
  aboveSheet?: React.ReactNode
  children: (api: SheetApi) => React.ReactNode
}

const OPEN_MS = 260
const CLOSE_MS = 220
const BACK_MS = 200
const AT_TOP = 0.5
const SAME_TOUCH_MS = 32
/** 中身の下の余白（ナビゲーションバーの分は別に足す） */
const CONTENT_BOTTOM = 36

export const BottomSheet: React.FC<Props> = ({
  visible,
  onRequestClose,
  onDragDismiss,
  dragBlocked = false,
  backgroundColor = '#fff',
  overlay,
  aboveSheet,
  children,
}) => {
  const { height: screenH } = useWindowDimensions()
  // Android（edge-to-edge）では Modal の中身がナビゲーションバーの下まで広がるので、その分を下に空ける（実機確認 D2）
  const insets = useSafeAreaInsets()
  const [rendered, setRendered] = useState(visible)
  const [keyboardOffset, setKeyboardOffset] = useState(0)
  const [sheetH, setSheetH] = useState(0)
  const ty = useRef(new Animated.Value(screenH)).current

  // 中身のスクロールの状態
  const scrollRef = useRef<ScrollView>(null)
  const scrollY = useRef(0)
  const [viewportH, setViewportH] = useState(0)
  const [contentH, setContentH] = useState(0)
  const [nativeScroll, setNativeScroll] = useState(false)
  const scrollable = contentH > viewportH + 1
  const maxScroll = Math.max(0, contentH - viewportH)

  // 1 回の操作（指を置いてから離すまで）の状態
  const gesture = useRef({
    atTopAtStart: true,
    /** 操作の始まりの時刻と、入力欄に指が触れた時刻（同じタッチなら同じ値になる） */
    startedAt: -1000,
    inputTouchedAt: -10000,
    lock: null as null | 'close' | 'scroll' | 'none',
    scrollStart: 0,
  })

  // 判定の中から最新の値を読むための参照
  const live = useRef({ dragBlocked, scrollable, nativeScroll, maxScroll, sheetH, screenH, onDragDismiss })
  live.current = { dragBlocked, scrollable, nativeScroll, maxScroll, sheetH, screenH, onDragDismiss }

  useEffect(() => {
    if (Platform.OS !== 'android') return
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKeyboardOffset(e.endCoordinates.height))
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOffset(0))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  // 開く・閉じる
  useEffect(() => {
    if (visible && !rendered) {
      ty.setValue(screenH)
      scrollY.current = 0
      setNativeScroll(false)
      setRendered(true)
      return
    }
    if (visible && rendered) {
      ty.stopAnimation()
      Animated.timing(ty, {
        toValue: 0,
        duration: OPEN_MS,
        easing: Easing.bezier(0.2, 0.8, 0.3, 1),
        useNativeDriver: true,
      }).start()
      return
    }
    if (!visible && rendered) {
      ty.stopAnimation()
      Animated.timing(ty, {
        toValue: Math.max(live.current.sheetH, 1) + 40,
        duration: CLOSE_MS,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setRendered(false)
      })
    }
    // ty・screenH は開閉のきっかけにしない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, rendered])

  const backToOpen = useCallback(() => {
    Animated.timing(ty, { toValue: 0, duration: BACK_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }).start()
  }, [ty])

  // 指を離したとき・取り消されたとき（つまみの帯・中身の両方で共通）
  const releaseClose = (g: PanResponderGestureState) => {
    const L = live.current
    const decision = decideSheetDismiss({ dy: g.dy, vy: g.vy, height: L.sheetH || L.screenH, cancelled: false })
    if (decision === 'close') {
      Keyboard.dismiss()
      L.onDragDismiss()
    } else {
      backToOpen()
    }
  }
  const releaseCloseRef = useRef(releaseClose)
  releaseCloseRef.current = releaseClose

  // つまみの帯（中身のスクロールの外）: 指を置いた時点で下スワイプを受け持つ。中にボタン・入力欄・スクロールが無いので、
  // 動きの取り合い（move の取り込み）に頼らずに確実に受け持てる（実機確認 D3）
  const handlePan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !live.current.dragBlocked,
        onMoveShouldSetPanResponder: () => !live.current.dragBlocked,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) => {
          ty.setValue(Math.max(0, g.dy))
        },
        onPanResponderRelease: (_, g) => releaseCloseRef.current(g),
        onPanResponderTerminate: () => backToOpen(),
      }),
    [ty, backToOpen],
  )

  // 中身の部分: 指を置いた時点ではボタン・入力欄に任せ、下へ動いたときに受け持つ
  const pan = useMemo(() => {
    const shouldClaimContentMove = (_: GestureResponderEvent, g: PanResponderGestureState): boolean => {
      const st = gesture.current
      // 同じタッチの知らせは同じ時刻を持つ。念のため少しのずれは同じタッチとみなす（前の操作の印は数百 ms 以上前）
      const startedInInput = Math.abs(st.inputTouchedAt - st.startedAt) <= SAME_TOUCH_MS
      if (st.lock !== null) return st.lock !== 'none'
      const dir = lockSheetDrag(g.dx, g.dy)
      if (dir === null) return false
      const L = live.current
      if (dir === 'down') {
        const ok = canStartSheetDrag({
          confirming: L.dragBlocked,
          busy: false,
          startedInInput,
          scrollAtTopAtStart: st.atTopAtStart,
        })
        st.lock = ok ? 'close' : 'none'
      } else {
        // 一番上で止めている中身を、上へ動かしてスクロールさせる
        const upFromTop = g.dy < 0 && Math.abs(g.dy) > Math.abs(g.dx)
        st.lock =
          upFromTop && L.scrollable && !L.nativeScroll && st.atTopAtStart && !startedInInput && !L.dragBlocked
            ? 'scroll'
            : 'none'
        st.scrollStart = scrollY.current
      }
      return st.lock !== 'none'
    }
    return PanResponder.create({
      // 操作の始まり（指を置いた時点ではシートは動かさず、中のボタン・入力欄に任せる）。開始時点の状態を記録する
      onStartShouldSetPanResponderCapture: (e) => {
        const st = gesture.current
        st.atTopAtStart = scrollY.current <= AT_TOP
        st.startedAt = e.nativeEvent.timestamp
        st.lock = null
        return false
      },
      // 取り込み（capture）と通常（bubble）の両方で同じ判定をする（どちらかの経路で受け持てるように）
      onMoveShouldSetPanResponderCapture: shouldClaimContentMove,
      onMoveShouldSetPanResponder: shouldClaimContentMove,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        const st = gesture.current
        if (st.lock === 'close') {
          ty.setValue(Math.max(0, g.dy))
        } else if (st.lock === 'scroll') {
          const y = Math.min(live.current.maxScroll, Math.max(0, st.scrollStart - g.dy))
          scrollRef.current?.scrollTo({ y, animated: false })
        }
      },
      onPanResponderRelease: (_, g) => {
        const st = gesture.current
        const L = live.current
        if (st.lock === 'close') {
          releaseCloseRef.current(g)
        } else if (st.lock === 'scroll') {
          // 指を離した後の慣性（簡易）。一番上から離れたら ScrollView のスクロールに戻す
          const target = Math.min(L.maxScroll, Math.max(0, st.scrollStart - g.dy - g.vy * 150))
          scrollRef.current?.scrollTo({ y: target, animated: true })
          if (target > AT_TOP) setNativeScroll(true)
        }
      },
      onPanResponderTerminate: () => {
        // 操作がシステムに取り消されたときは元の位置に戻す（閉じない）
        if (gesture.current.lock === 'close') backToOpen()
      },
    })
  }, [ty, backToOpen])

  // 入力欄に指が触れた（この操作の始まりの時刻と同じなら、入力欄の中から始めた操作）
  const markInputTouch = useCallback((e: GestureResponderEvent) => {
    gesture.current.inputTouchedAt = e.nativeEvent.timestamp
  }, [])

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = e.nativeEvent.contentOffset.y
    if (scrollY.current > AT_TOP && !nativeScroll) setNativeScroll(true)
  }
  // ScrollView のドラッグ・慣性が一番上で終わったら、次の操作から下スワイプで閉じられるように止める
  const onScrollSettled = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = e.nativeEvent.contentOffset.y
    if (scrollY.current <= AT_TOP) setNativeScroll(false)
  }

  const backdropOpacity = ty.interpolate({
    inputRange: [0, Math.max(sheetH, 1)],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  })

  return (
    <Modal visible={rendered} transparent animationType="none" onRequestClose={onRequestClose}>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onRequestClose} />
        </Animated.View>
        <View style={[styles.wrapper, { paddingBottom: keyboardOffset }]} pointerEvents="box-none">
          <Animated.View
            style={[styles.sheet, { backgroundColor, transform: [{ translateY: ty }] }]}
            onLayout={(e: LayoutChangeEvent) => setSheetH(e.nativeEvent.layout.height)}
            {...pan.panHandlers}
          >
            <View style={styles.handleZone} {...handlePan.panHandlers}>
              <View style={styles.handle} />
            </View>
            <ScrollView
              ref={scrollRef}
              style={styles.scroll}
              contentContainerStyle={[
                styles.content,
                { paddingBottom: sheetBottomPadding({ base: CONTENT_BOTTOM, insetBottom: insets.bottom, keyboardOffset }) },
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              scrollEnabled={scrollable && nativeScroll}
              scrollEventThrottle={16}
              onScroll={onScroll}
              onScrollEndDrag={onScrollSettled}
              onMomentumScrollEnd={onScrollSettled}
              onLayout={(e) => setViewportH(e.nativeEvent.layout.height)}
              onContentSizeChange={(_, h) => setContentH(h)}
              overScrollMode="never"
              bounces={false}
            >
              {children({ markInputTouch })}
            </ScrollView>
            {overlay}
          </Animated.View>
        </View>
        {aboveSheet}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.4)' },
  wrapper: { flex: 1, justifyContent: 'flex-end', paddingTop: 40 },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, flexShrink: 1, overflow: 'hidden' },
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { paddingHorizontal: 20, paddingTop: 4, gap: 12 },
  // つまみの帯（指で掴みやすいよう高さを取る）
  handleZone: { alignItems: 'center', justifyContent: 'center', paddingTop: 12, paddingBottom: 12 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#ddd' },
})
