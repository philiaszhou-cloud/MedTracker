package com.medtracker.app.ui.settings

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.medtracker.app.data.entity.Reminder
import com.medtracker.app.databinding.ItemReminderBinding

class ReminderAdapter(
    private val onToggle: (Reminder, Boolean) -> Unit,
    private val onDelete: (Reminder) -> Unit
) : ListAdapter<Reminder, ReminderAdapter.ViewHolder>(DiffCallback()) {

    inner class ViewHolder(private val binding: ItemReminderBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(reminder: Reminder) {
            binding.tvReminderTime.text = "%02d:%02d".format(reminder.hour, reminder.minute)
            binding.tvReminderLabel.text = reminder.label
            binding.switchReminder.isChecked = reminder.isEnabled

            binding.switchReminder.setOnCheckedChangeListener { _, isChecked ->
                onToggle(reminder, isChecked)
            }

            binding.btnDeleteReminder.setOnClickListener {
                onDelete(reminder)
            }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemReminderBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    class DiffCallback : DiffUtil.ItemCallback<Reminder>() {
        override fun areItemsTheSame(oldItem: Reminder, newItem: Reminder) = oldItem.id == newItem.id
        override fun areContentsTheSame(oldItem: Reminder, newItem: Reminder) = oldItem == newItem
    }
}
