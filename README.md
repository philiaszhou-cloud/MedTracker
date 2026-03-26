# MedTracker - 姣忔棩鏈嶈嵂璁板綍 Android APP

## 椤圭洰姒傝堪

涓€涓府鍔╃敤鎴锋瘡澶╄褰曟湇鑽儏鍐电殑 Android APP锛屾敮鎸佹憚鍍忓ご鎷嶇収璁板綍銆佽嵂鐗╀俊鎭鐞嗐€佹彁閱掕缃拰鍘嗗彶鏌ョ湅銆?

## 鍔熻兘鐗规€?

### 馃彔 涓荤晫闈紙浠婃棩锛?
- 鏄剧ず浠婃棩鏃ユ湡鍜屾湇鑽姸鎬侊紙宸叉湇/鏈湇锛?
- 涓€閿墦寮€鎽勫儚澶存媿鐓ц褰?
- 灞曠ず宸茶缃殑5绉嶈嵂鐗╀俊鎭?
- 鏈€杩戞湇鑽粺璁?

### 馃摲 鎽勫儚澶存媿鐓?
- 浣跨敤 CameraX 璋冪敤鍚庣疆鎽勫儚澶?
- 鍏ㄥ睆鎽勫儚澶撮瑙?
- 鎷嶇収鍚庨瑙堢‘璁?閲嶆媿
- 椤堕儴鏄剧ず姣忕鑽墿鐨勯鑹插拰褰㈢姸鎻愮ず
- 鐓х墖鑷姩淇濆瓨鍒?Pictures/MedTracker/ 鐩綍
- 纭鍚庝繚瀛樻湇鑽褰?

### 鈿欙笍 璁剧疆鐣岄潰
**鑽墿绠＄悊锛?*
- 娣诲姞/缂栬緫/鍒犻櫎鑽墿
- 鑽墿鍚嶇О銆侀鑹诧紙10绉嶉璁撅級銆佸舰鐘讹紙7绉嶉璁撅級
- 姣忔鍓傞噺璁剧疆
- 鍙€夊弬鑰冪収鐗?

**鎻愰啋绠＄悊锛?*
- 娣诲姞澶氫釜鎻愰啋鏃堕棿
- 鏃堕棿閫夋嫨鍣紙24灏忔椂鍒讹級
- 鎻愰啋鏍囩锛堝锛氭棭椁愬悗銆佺潯鍓嶏級
- 寮€鍏冲崟鐙帶鍒舵瘡涓彁閱?

### 馃搵 鍘嗗彶璁板綍
- 鎸夋棩鏈熷垪鍑烘墍鏈夋湇鑽褰?
- 姣忔潯璁板綍鏄剧ず鏃ユ湡銆佺姸鎬併€佹湇鑽椂闂?
- 鐓х墖缂╃暐鍥?
- 鐐瑰嚮鏌ョ湅鍏ㄥ睆澶у浘
- 缁熻瀹屾垚鐜?

## 鎶€鏈灦鏋?

```
com.medtracker.app/
鈹溾攢鈹€ data/
鈹?  鈹溾攢鈹€ entity/          # Room瀹炰綋锛歁edication, MedicationRecord, Reminder
鈹?  鈹溾攢鈹€ dao/             # 鏁版嵁璁块棶锛歁edicationDao, RecordDao, ReminderDao
鈹?  鈹斺攢鈹€ database/        # AppDatabase锛圧oom鏁版嵁搴擄級
鈹溾攢鈹€ ui/
鈹?  鈹溾攢鈹€ main/            # MainActivity, HomeFragment
鈹?  鈹溾攢鈹€ camera/          # CameraFragment锛圕ameraX锛?
鈹?  鈹溾攢鈹€ settings/        # SettingsFragment, AddMedicationFragment, Adapters
鈹?  鈹斺攢鈹€ history/         # HistoryFragment, HistoryAdapter, PhotoViewFragment
鈹溾攢鈹€ viewmodel/           # MainViewModel锛堢粺涓€鐘舵€佺鐞嗭級
鈹溾攢鈹€ reminder/            # ReminderReceiver, ReminderScheduler锛圓larmManager锛?
鈹斺攢鈹€ MedTrackerApplication.kt
```

**涓昏渚濊禆锛?*
- CameraX 1.3.1 鈥?鎽勫儚澶?
- Room 2.6.1 鈥?鏈湴鏁版嵁搴?
- Navigation Component 2.7.6 鈥?椤甸潰瀵艰埅
- Glide 4.16.0 鈥?鍥剧墖鍔犺浇
- Material Components 鈥?UI缁勪欢
- AlarmManager 鈥?鎻愰啋璋冨害

## 椤圭洰鏂囦欢浣嶇疆

`c:\Users\ThinkPad\WorkBuddy\20260326092742\MedTracker\`

## 濡備綍缂栬瘧杩愯

### 鏂瑰紡涓€锛欰ndroid Studio锛堟帹鑽愶級
1. 瀹夎 Android Studio Hedgehog 鎴栨洿鏂扮増鏈?
2. File 鈫?Open 鈫?閫夋嫨 `MedTracker` 鏂囦欢澶?
3. 绛夊緟 Gradle 鍚屾瀹屾垚
4. 杩炴帴 Android 鎵嬫満锛堝紑鍚紑鍙戣€呮ā寮忓拰USB璋冭瘯锛夋垨鍒涘缓铏氭嫙璁惧
5. 鐐瑰嚮 鈻?杩愯

### 鏂瑰紡浜岋細鍛戒护琛?
```bash
cd MedTracker
./gradlew assembleDebug
# APK 鐢熸垚浣嶇疆: app/build/outputs/apk/debug/app-debug.apk
```

## 棣栨浣跨敤娴佺▼
1. 瀹夎 APP
2. 鎺堟潈鎽勫儚澶淬€侀€氱煡銆佸瓨鍌ㄦ潈闄?
3. 杩涘叆銆岃缃€嶁啋 娣诲姞5绉嶈嵂鐗╋紙濉啓鍚嶇О銆侀€夋嫨棰滆壊鍜屽舰鐘讹級
4. 鍦ㄣ€岃缃€嶁啋 娣诲姞姣忔棩鎻愰啋鏃堕棿
5. 姣忓ぉ鏀跺埌鎻愰啋鍚庯紝鎵撳紑 APP 鈫?灏?绉嶈嵂鏀惧湪涓€璧?鈫?鎷嶇収 鈫?纭鏈嶈嵂

## 娉ㄦ剰浜嬮」
- 鏈€浣?Android 鐗堟湰锛?.0锛圓PI 26锛?
- 闇€瑕?Android 12+ 鎵嶈兘浣跨敤绮剧‘闂归挓锛圫CHEDULE_EXACT_ALARM锛?
- 鐓х墖瀛樺偍鍦ㄦ墜鏈虹浉鍐岀殑 MedTracker 鏂囦欢澶逛腑
- 鎻愰啋鍦ㄩ噸鍚悗浼氳嚜鍔ㄩ噸鏂版敞鍐岋紙閫氳繃 BOOT_COMPLETED锛?


-- Updated at 2026-03-26 23:15:14