package com.medtracker.app.ui.settings

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.snackbar.Snackbar
import com.medtracker.app.R
import com.medtracker.app.databinding.FragmentSettingsBinding
import com.medtracker.app.data.entity.Reminder
import com.medtracker.app.reminder.ReminderScheduler
import com.medtracker.app.viewmodel.MainViewModel

class SettingsFragment : Fragment() {

    private var _binding: FragmentSettingsBinding? = null
    private val binding get() = _binding!!
    private val viewModel: MainViewModel by activityViewModels()

    private lateinit var medicationAdapter: MedicationSettingsAdapter
    private lateinit var reminderAdapter: ReminderAdapter

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentSettingsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupMedicationList()
        setupReminderList()

        // 添加药物
        binding.btnAddMedication.setOnClickListener {
            findNavController().navigate(R.id.action_settingsFragment_to_addMedicationFragment)
        }

        // 添加提醒
        binding.btnAddReminder.setOnClickListener {
            showAddReminderDialog()
        }
    }

    private fun setupMedicationList() {
        medicationAdapter = MedicationSettingsAdapter(
            onEdit = { medication ->
                val bundle = Bundle().apply {
                    putLong("medication_id", medication.id)
                }
                findNavController().navigate(
                    R.id.action_settingsFragment_to_addMedicationFragment,
                    bundle
                )
            },
            onDelete = { medication ->
                MaterialAlertDialogBuilder(requireContext())
                    .setTitle("删除药物")
                    .setMessage("确定要删除「${medication.name}」吗？")
                    .setPositiveButton("删除") { _, _ ->
                        viewModel.deleteMedication(medication)
                        Snackbar.make(binding.root, "已删除 ${medication.name}", Snackbar.LENGTH_SHORT).show()
                    }
                    .setNegativeButton("取消", null)
                    .show()
            }
        )

        binding.rvMedications.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = medicationAdapter
        }

        viewModel.medications.observe(viewLifecycleOwner) { medications ->
            medicationAdapter.submitList(medications)
            binding.tvMedEmpty.visibility = if (medications.isEmpty()) View.VISIBLE else View.GONE
            binding.tvMedCount.text = "已设置 ${medications.size}/5 种药物"
        }
    }

    private fun setupReminderList() {
        reminderAdapter = ReminderAdapter(
            onToggle = { reminder, enabled ->
                viewModel.setReminderEnabled(reminder.id, enabled)
                if (enabled) {
                    ReminderScheduler.scheduleReminder(
                        requireContext(), reminder.id, reminder.hour, reminder.minute, reminder.label
                    )
                } else {
                    ReminderScheduler.cancelReminder(requireContext(), reminder.id)
                }
            },
            onDelete = { reminder ->
                viewModel.deleteReminder(reminder)
                ReminderScheduler.cancelReminder(requireContext(), reminder.id)
                Snackbar.make(binding.root, "已删除提醒", Snackbar.LENGTH_SHORT).show()
            }
        )

        binding.rvReminders.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = reminderAdapter
        }

        viewModel.reminders.observe(viewLifecycleOwner) { reminders ->
            reminderAdapter.submitList(reminders)
            binding.tvReminderEmpty.visibility = if (reminders.isEmpty()) View.VISIBLE else View.GONE
        }
    }

    private fun showAddReminderDialog() {
        val dialogView = LayoutInflater.from(requireContext())
            .inflate(R.layout.dialog_add_reminder, null)

        val timePicker = dialogView.findViewById<android.widget.TimePicker>(R.id.timePicker)
        timePicker.setIs24HourView(true)

        val labelEdit = dialogView.findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.etLabel)

        MaterialAlertDialogBuilder(requireContext())
            .setTitle("添加提醒时间")
            .setView(dialogView)
            .setPositiveButton("添加") { _, _ ->
                val hour = timePicker.hour
                val minute = timePicker.minute
                val label = labelEdit.text?.toString()?.ifBlank { "服药提醒" } ?: "服药提醒"

                val reminder = Reminder(hour = hour, minute = minute, label = label)
                viewModel.insertReminder(reminder)

                // 注册提醒（插入后获取ID需要异步，此处先注册临时）
                viewModel.reminders.value?.let { reminders ->
                    val newReminder = reminders.find { it.hour == hour && it.minute == minute }
                    newReminder?.let {
                        ReminderScheduler.scheduleReminder(
                            requireContext(), it.id, it.hour, it.minute, it.label
                        )
                    }
                }
                Snackbar.make(binding.root, "已添加 $hour:${minute.toString().padStart(2,'0')} 的提醒", Snackbar.LENGTH_SHORT).show()
            }
            .setNegativeButton("取消", null)
            .show()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
