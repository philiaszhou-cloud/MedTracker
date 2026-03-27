package com.medtracker.app.ui.history

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import com.medtracker.app.R
import com.medtracker.app.databinding.FragmentHistoryBinding
import com.medtracker.app.viewmodel.MainViewModel

class HistoryFragment : Fragment() {

    private var _binding: FragmentHistoryBinding? = null
    private val binding get() = _binding!!
    private val viewModel: MainViewModel by activityViewModels()
    private lateinit var adapter: HistoryAdapter

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentHistoryBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        adapter = HistoryAdapter { record ->
            // 点击查看大图
            val bundle = Bundle().apply {
                putString("photo_path", record.photoPath)
                putString("date", record.date)
                putString("taken_time", record.takenTime)
            }
            findNavController().navigate(R.id.action_historyFragment_to_photoViewFragment, bundle)
        }

        binding.rvHistory.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = this@HistoryFragment.adapter
        }

        viewModel.recentRecords.observe(viewLifecycleOwner) { records ->
            adapter.submitList(records)
            val takenCount = records.count { it.isTaken }
            binding.tvStats.text = "最近 ${records.size} 天 · 已服药 $takenCount 天 · 完成率 ${
                if (records.isEmpty()) 0 else (takenCount * 100 / records.size)
            }%"
            binding.tvEmpty.visibility = if (records.isEmpty()) View.VISIBLE else View.GONE
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
