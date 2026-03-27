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

        // 显示今日日期
        val dateFormat = SimpleDateFormat("yyyy年MM月dd日 EEEE", Locale.CHINESE)
        binding.tvTodayDate.text = dateFormat.format(Date())

        // 观察今日服药记录
        viewModel.getTodayRecord().observe(viewLifecycleOwner) { record ->
            if (record != null && record.isTaken) {
                binding.cardTodayStatus.setCardBackgroundColor(
                    requireContext().getColor(R.color.status_taken)
                )
                binding.tvTodayStatus.text = "✅ 今日已服药"
                binding.tvTakenTime.text = "服药时间：${record.takenTime}"
                binding.tvTakenTime.visibility = View.VISIBLE
                binding.btnTakePhoto.text = "重新拍照"
            } else {
                binding.cardTodayStatus.setCardBackgroundColor(
                    requireContext().getColor(R.color.status_pending)
                )
                binding.tvTodayStatus.text = "⏰ 今日尚未服药"
                binding.tvTakenTime.visibility = View.GONE
                binding.btnTakePhoto.text = "拍照记录服药"
            }
        }

        // 观察药物列表
        viewModel.medications.observe(viewLifecycleOwner) { medications ->
            binding.tvMedCount.text = "已设置 ${medications.size} 种药物"

            // 显示药物简要列表
            val medNames = medications.joinToString(" · ") { it.name }
            binding.tvMedList.text = if (medNames.isNotEmpty()) medNames else "暂未设置药物，请前往设置"

            if (medications.isEmpty()) {
                binding.cardSetupHint.visibility = View.VISIBLE
            } else {
                binding.cardSetupHint.visibility = View.GONE
            }
        }

        // 按钮点击：打开摄像头
        binding.btnTakePhoto.setOnClickListener {
            findNavController().navigate(R.id.action_homeFragment_to_cameraFragment)
        }

        // 设置提示卡片点击
        binding.cardSetupHint.setOnClickListener {
            findNavController().navigate(R.id.action_homeFragment_to_settingsFragment)
        }

        // 查看历史
        binding.btnViewHistory.setOnClickListener {
            findNavController().navigate(R.id.action_homeFragment_to_historyFragment)
        }

        // 最近记录
        viewModel.recentRecords.observe(viewLifecycleOwner) { records ->
            val takenCount = records.count { it.isTaken }
            binding.tvRecentStats.text = "最近${records.size}天：已服药 $takenCount 次"
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
