package com.assembly.meeting.model;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "meetings")
public class Meeting {

    @Id
    private String id;
    
    private String title;
    private String week;
    private String date;

    @Column(columnDefinition = "TEXT")
    private String summary;

    @Column(columnDefinition = "TEXT")
    private String regularReport;

    private String createdAt;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "meeting_issue_ids", joinColumns = @JoinColumn(name = "meeting_id"))
    @Column(name = "issue_id")
    private List<String> issueIds = new ArrayList<>();

    // Constructors
    public Meeting() {}

    public Meeting(String id, String title, String week, String date, String summary, 
                   String regularReport, String createdAt, List<String> issueIds) {
        this.id = id;
        this.title = title;
        this.week = week;
        this.date = date;
        this.summary = summary;
        this.regularReport = regularReport;
        this.createdAt = createdAt;
        if (issueIds != null) {
            this.issueIds = issueIds;
        }
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

    public String getWeek() {
        return week;
    }

    public void setWeek(String week) {
        this.week = week;
    }

    public String getDate() {
        return date;
    }

    public void setDate(String date) {
        this.date = date;
    }

    public String getSummary() {
        return summary;
    }

    public void setSummary(String summary) {
        this.summary = summary;
    }

    public String getRegularReport() {
        return regularReport;
    }

    public void setRegularReport(String regularReport) {
        this.regularReport = regularReport;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public List<String> getIssueIds() {
        return issueIds;
    }

    public void setIssueIds(List<String> issueIds) {
        this.issueIds = issueIds;
    }
}
