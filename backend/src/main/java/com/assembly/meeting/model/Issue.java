package com.assembly.meeting.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "issues")
public class Issue {

    @Id
    private String id;
    
    private String title;
    private String category;
    private String priority; // 'low' | 'medium' | 'high' | 'urgent'
    private String status;   // 'todo' | 'in_progress' | 'completed'

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(columnDefinition = "TEXT")
    private String discussion;

    private String signature; // Responsible member ID or name
    private String createdAt;
    private String updatedAt;
    
    private boolean archived;
    private String archivedAt;
    
    private String meetingId;

    // Constructors
    public Issue() {}

    public Issue(String id, String title, String category, String priority, String status, 
                 String description, String discussion, String signature, String createdAt, 
                 String updatedAt, boolean archived, String archivedAt, String meetingId) {
        this.id = id;
        this.title = title;
        this.category = category;
        this.priority = priority;
        this.status = status;
        this.description = description;
        this.discussion = discussion;
        this.signature = signature;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.archived = archived;
        this.archivedAt = archivedAt;
        this.meetingId = meetingId;
    }

    // Getters and Setters
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getPriority() {
        return priority;
    }

    public void setPriority(String priority) {
        this.priority = priority;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getDiscussion() {
        return discussion;
    }

    public void setDiscussion(String discussion) {
        this.discussion = discussion;
    }

    public String getSignature() {
        return signature;
    }

    public void setSignature(String signature) {
        this.signature = signature;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public String getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(String updatedAt) {
        this.updatedAt = updatedAt;
    }

    public boolean isArchived() {
        return archived;
    }

    public void setArchived(boolean archived) {
        this.archived = archived;
    }

    public String getArchivedAt() {
        return archivedAt;
    }

    public void setArchivedAt(String archivedAt) {
        this.archivedAt = archivedAt;
    }

    public String getMeetingId() {
        return meetingId;
    }

    public void setMeetingId(String meetingId) {
        this.meetingId = meetingId;
    }
}
