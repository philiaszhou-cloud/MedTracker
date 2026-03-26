package com.medtracker.app.ui.main

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.navigation.fragment.findNavController
import com.medtracker.app.R
import com.medtracker.app.databinding.FragmentHomeBinding
import com.medtracker.app.viewmodel.MainViewModel
import java.text.SimpleDateFormat
import java.util.*

class HomeFragment : Fragment() {

    private var _binding: FragmentHomeBinding? = null
    private val binding get() = _binding!!
    private val viewModel: MainViewModel by activityViewModels()

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentHomeBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        // 鏄剧ず浠婃棩鏃ユ湡
        val dateFormat = SimpleDateFormat("yyyy骞碝M鏈坉d鏃?EEEE", Locale.CHINESE)
        binding.tvTodayDate.text = dateFormat.format(Date())

        // 瑙傚療浠婃棩鏈嶈嵂璁板綍
        viewModel.getTodayRecord().observe(viewLifecycleOwner) { record ->
            if (record != null && record.isTaken) {
                binding.cardTodayStatus.setCardBackgroundColor(
                    requireContext().getColor(R.color.status_taken)
                )
                binding.tvTodayStatus.text = "鉁?浠婃棩宸叉湇鑽?
                binding.tvTakenTime.text = "鏈嶈嵂鏃堕棿锛?{record.takenTime}"
                binding.tvTakenTime.visibility = View.VISIBLE
                binding.btnTakePhoto.text = "閲嶆柊鎷嶇収"
            } else {
                binding.cardTodayStatus.setCardBackgroundColor(
                    requireContext().getColor(R.color.status_pending)
                )
                binding.tvTodayStatus.text = "鈴?浠婃棩灏氭湭鏈嶈嵂"
                binding.tvTakenTime.visibility = View.GONE
                binding.btnTakePhoto.text = "鎷嶇収璁板綍鏈嶈嵂"
            }
        }

        // 瑙傚療鑽墿鍒楄〃
        viewModel.medications.observe(viewLifecycleOwner) { medications ->
            binding.tvMedCount.text = "宸茶缃?${medications.size} 绉嶈嵂鐗?

            // 鏄剧ず鑽墿绠€瑕佸垪琛?
            val medNames = medications.joinToString(" 路 ") { it.name }
            binding.tvMedList.text = if (medNames.isNotEmpty()) medNames else "鏆傛湭璁剧疆鑽墿锛岃鍓嶅線璁剧疆"

            if (medications.isEmpty()) {
                binding.cardSetupHint.visibility = View.VISIBLE
            } else {
                binding.cardSetupHint.visibility = View.GONE
            }
        }

        // 鎸夐挳鐐瑰嚮锛氭墦寮€鎽勫儚澶?
        binding.btnTakePhoto.setOnClickListener {
            findNavController().navigate(R.id.action_homeFragment_to_cameraFragment)
        }

        // 璁剧疆鎻愮ず鍗＄墖鐐瑰嚮
        binding.cardSetupHint.setOnClickListener {
            findNavController().navigate(R.id.action_homeFragment_to_settingsFragment)
        }

        // 鏌ョ湅鍘嗗彶
        binding.btnViewHistory.setOnClickListener {
            findNavController().navigate(R.id.action_homeFragment_to_historyFragment)
        }

        // 鏈€杩戣褰?
        viewModel.recentRecords.observe(viewLifecycleOwner) { records ->
            val takenCount = records.count { it.isTaken }
            binding.tvRecentStats.text = "鏈€杩?{records.size}澶╋細宸叉湇鑽?$takenCount 娆?
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
