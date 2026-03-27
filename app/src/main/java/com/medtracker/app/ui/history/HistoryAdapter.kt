package com.medtracker.app.ui.history

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.medtracker.app.data.entity.MedicationRecord
import com.medtracker.app.databinding.ItemHistoryBinding

class HistoryAdapter(
    private val onItemClick: (MedicationRecord) -> Unit
) : ListAdapter<MedicationRecord, HistoryAdapter.ViewHolder>(DiffCallback()) {

    inner class ViewHolder(private val binding: ItemHistoryBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(record: MedicationRecord) {
            binding.tvDate.text = record.date
            binding.tvStatus.text = if (record.isTaken) "✅ 已服药" else "❌ 未服药"
            binding.tvTime.text = if (record.takenTime.isNotEmpty()) "服药时间：${record.takenTime}" else ""
            binding.tvTime.visibility = if (record.takenTime.isNotEmpty()) View.VISIBLE else View.GONE

            if (record.photoPath.isNotEmpty()) {
                binding.imgThumb.visibility = View.VISIBLE
                Glide.with(binding.root.context)
                    .load(record.photoPath)
                    .centerCrop()
                    .placeholder(android.R.drawable.ic_menu_gallery)
                    .into(binding.imgThumb)
            } else {
                binding.imgThumb.visibility = View.GONE
            }

            binding.root.setOnClickListener {
                if (record.photoPath.isNotEmpty()) {
                    onItemClick(record)
                }
            }

            // 设置状态颜色
            val context = binding.root.context
            if (record.isTaken) {
                binding.cardRecord.strokeColor = context.getColor(com.medtracker.app.R.color.status_taken)
            } else {
                binding.cardRecord.strokeColor = context.getColor(com.medtracker.app.R.color.status_pending)
            }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemHistoryBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    class DiffCallback : DiffUtil.ItemCallback<MedicationRecord>() {
        override fun areItemsTheSame(oldItem: MedicationRecord, newItem: MedicationRecord) = oldItem.id == newItem.id
        override fun areContentsTheSame(oldItem: MedicationRecord, newItem: MedicationRecord) = oldItem == newItem
    }
}
