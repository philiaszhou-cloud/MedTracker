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

        // 娣诲姞鑽墿
        binding.btnAddMedication.setOnClickListener {
            findNavController().navigate(R.id.action_settingsFragment_to_addMedicationFragment)
        }

        // 娣诲姞鎻愰啋
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
                    .setTitle("鍒犻櫎鑽墿")
                    .setMessage("纭畾瑕佸垹闄ゃ€?{medication.name}銆嶅悧锛?)
                    .setPositiveButton("鍒犻櫎") { _, _ ->
                        viewModel.deleteMedication(medication)
                        Snackbar.make(binding.root, "宸插垹闄?${medication.name}", Snackbar.LENGTH_SHORT).show()
                    }
                    .setNegativeButton("鍙栨秷", null)
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
            binding.tvMedCount.text = "宸茶缃?${medications.size}/5 绉嶈嵂鐗?
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
                Snackbar.make(binding.root, "宸插垹闄ゆ彁閱?, Snackbar.LENGTH_SHORT).show()
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
            .setTitle("娣诲姞鎻愰啋鏃堕棿")
            .setView(dialogView)
            .setPositiveButton("娣诲姞") { _, _ ->
                val hour = timePicker.hour
                val minute = timePicker.minute
                val label = labelEdit.text?.toString()?.ifBlank { "鏈嶈嵂鎻愰啋" } ?: "鏈嶈嵂鎻愰啋"

                val reminder = Reminder(hour = hour, minute = minute, label = label)
                viewModel.insertReminder(reminder)

                // 娉ㄥ唽鎻愰啋锛堟彃鍏ュ悗鑾峰彇ID闇€瑕佸紓姝ワ紝姝ゅ鍏堟敞鍐屼复鏃讹級
                viewModel.reminders.value?.let { reminders ->
                    val newReminder = reminders.find { it.hour == hour && it.minute == minute }
                    newReminder?.let {
                        ReminderScheduler.scheduleReminder(
                            requireContext(), it.id, it.hour, it.minute, it.label
                        )
                    }
                }
                Snackbar.make(binding.root, "宸叉坊鍔?$hour:${minute.toString().padStart(2,'0')} 鐨勬彁閱?, Snackbar.LENGTH_SHORT).show()
            }
            .setNegativeButton("鍙栨秷", null)
            .show()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
