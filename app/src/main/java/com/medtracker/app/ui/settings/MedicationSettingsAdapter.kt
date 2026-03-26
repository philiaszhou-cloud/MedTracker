package com.medtracker.app.ui.settings

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.medtracker.app.data.entity.Medication
import com.medtracker.app.databinding.ItemMedicationSettingBinding

class MedicationSettingsAdapter(
    private val onEdit: (Medication) -> Unit,
    private val onDelete: (Medication) -> Unit
) : ListAdapter<Medication, MedicationSettingsAdapter.ViewHolder>(DiffCallback()) {

    inner class ViewHolder(private val binding: ItemMedicationSettingBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(medication: Medication) {
            binding.tvMedName.text = medication.name
            binding.tvMedDetail.text = "${medication.color} 路 ${medication.shape} 路 ${medication.dosage}"
            binding.viewColorIndicator.setBackgroundColor(medication.colorCode)

            binding.btnEdit.setOnClickListener { onEdit(medication) }
            binding.btnDelete.setOnClickListener { onDelete(medication) }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemMedicationSettingBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    class DiffCallback : DiffUtil.ItemCallback<Medication>() {
        override fun areItemsTheSame(oldItem: Medication, newItem: Medication) = oldItem.id == newItem.id
        override fun areContentsTheSame(oldItem: Medication, newItem: Medication) = oldItem == newItem
    }
}
